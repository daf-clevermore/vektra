"use client";

import { useEffect, useRef, useCallback } from "react";
import { Canvas, loadSVGFromString, FabricObject } from "fabric";

interface DesignCanvasProps {
    svgString: string | null;
    onCanvasReady: (canvas: Canvas) => void;
    onSelectionChange: (selected: FabricObject | null) => void;
    onObjectsChange: (objects: FabricObject[]) => void;
    onHistorySnapshot: () => void;
    suppressHistory: boolean;
    width?: number;
    height?: number;
    zoom?: number;
}

const LOCK_PROPERTIES = {
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    hasControls: false,
};

export default function DesignCanvas({
    svgString,
    onCanvasReady,
    onSelectionChange,
    onObjectsChange,
    onHistorySnapshot,
    suppressHistory,
    width = 800,
    height = 600,
    zoom = 1,
}: DesignCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<Canvas | null>(null);
    const suppressRef = useRef(false);

    const dimRef = useRef({ width, height });
    useEffect(() => {
        dimRef.current = { width, height };
    }, [width, height]);

    // Keep suppression flag in sync with the parent (used for undo/loading)
    useEffect(() => {
        suppressRef.current = suppressHistory;
    }, [suppressHistory]);

    // Sync current elements to parent React state
    const updateObjectsList = useCallback((fc: Canvas) => {
        const objs = fc.getObjects();
        onObjectsChange([...objs]);
    }, [onObjectsChange]);

    // Apply "background" lock to the element that fills the canvas
    const applyBackgroundLock = useCallback((fc: Canvas) => {
        const objs = fc.getObjects();

        // 1) Prefer an object explicitly named "background"
        let bg = objs.find(
            (o) => String((o as { name?: unknown }).name || "").toLowerCase() === "background"
        );

        // 2) Otherwise, pick the object covering the largest area
        if (!bg) {
            let maxArea = -1;
            for (const o of objs) {
                const area =
                    (o.width || 0) *
                    (o.scaleX || 1) *
                    (o.height || 0) *
                    (o.scaleY || 1);
                if (area > maxArea) {
                    maxArea = area;
                    bg = o;
                }
            }
        }

        if (bg) {
            bg.set({ ...LOCK_PROPERTIES, selectable: false });
            // Push to back so it acts as a bottom layer
            fc.moveObjectTo(bg, 0);
        }
    }, []);

    // Initialize Fabric Canvas
    useEffect(() => {
        if (!canvasRef.current) return;
        const fc = new Canvas(canvasRef.current, {
            width,
            height,
            backgroundColor: "#ffffff",
            // Deselect when clicking empty space (default true, explicit for clarity)
            selection: true,
            // PENTING: jaga z-order layer tetap konsisten saat objek di-select.
            // Tanpa ini, Fabric me-render objek aktif di atas semua layer lain
            // secara visual, yang terlihat seperti layer mendadak berpindah ke atas.
            preserveObjectStacking: true,
        });
        fabricRef.current = fc;
        onCanvasReady(fc);

        // Bind Canvas Selection Events
        const handleSelectionCreated = (e: { selected: FabricObject[] }) => {
            onSelectionChange(e.selected[0] || null);
        };
        const handleSelectionUpdated = (e: { selected: FabricObject[] }) => {
            onSelectionChange(e.selected[0] || null);
        };
        const handleSelectionCleared = () => {
            onSelectionChange(null);
        };

        // Bind Objects List + history sync events.
        // During bulk loads (SVG render / undo restore) suppressRef is set, so we
        // skip the per-object React syncs and let the caller perform a single final
        // updateObjectsList() + onHistorySnapshot() instead. This avoids N re-renders
        // (and N history captures) when a design with dozens of SVG elements is created.
        const handleObjectAdded = () => {
            if (suppressRef.current) return;
            updateObjectsList(fc);
            onHistorySnapshot();
        };
        const handleObjectRemoved = () => {
            onSelectionChange(fc.getActiveObject() || null);
            if (suppressRef.current) return;
            updateObjectsList(fc);
            onHistorySnapshot();
        };
        const handleObjectModified = () => {
            if (suppressRef.current) return;
            updateObjectsList(fc);
            onHistorySnapshot();
        };

        // ── Smart Snapping & Magnetic Guidelines ─────────────────────
        interface GuideLine {
            x?: number;
            y?: number;
            x1?: number;
            x2?: number;
            y1?: number;
            y2?: number;
        }
        const guidelines: GuideLine[] = [];
        const SNAP_THRESHOLD = 6;

        const handleObjectMoving = (e: { target?: FabricObject }) => {
            const target = e.target;
            if (!target) return;

            guidelines.length = 0;

            const targetScaleX = target.scaleX || 1;
            const targetScaleY = target.scaleY || 1;
            const targetW = (target.width || 0) * targetScaleX;
            const targetH = (target.height || 0) * targetScaleY;
            const targetL = target.left || 0;
            const targetT = target.top || 0;
            const targetR = targetL + targetW;
            const targetB = targetT + targetH;
            const targetCX = targetL + targetW / 2;
            const targetCY = targetT + targetH / 2;

            const curWidth = dimRef.current.width;
            const curHeight = dimRef.current.height;

            // Canvas boundary & center guidelines (clean alignment)
            const verticalLines: { x: number; y1: number; y2: number }[] = [
                { x: 0, y1: 0, y2: curHeight },
                { x: curWidth / 2, y1: 0, y2: curHeight },
                { x: curWidth, y1: 0, y2: curHeight },
            ];

            const horizontalLines: { y: number; x1: number; x2: number }[] = [
                { y: 0, x1: 0, x2: curWidth },
                { y: curHeight / 2, x1: 0, x2: curWidth },
                { y: curHeight, x1: 0, x2: curWidth },
            ];

            // Object-to-object guidelines (only for main/significant objects, not tiny paths)
            const allObjs = fc.getObjects();
            const canvasArea = curWidth * curHeight;
            const significantObjs = allObjs.filter((obj) => {
                if (obj === target || obj.selectable === false) return false;
                const oW = (obj.width || 0) * (obj.scaleX || 1);
                const oH = (obj.height || 0) * (obj.scaleY || 1);
                const area = oW * oH;
                // Only consider objects that cover > 2% of canvas or if total objects <= 12
                return allObjs.length <= 12 || area > canvasArea * 0.02;
            });

            for (const obj of significantObjs) {
                const oScaleX = obj.scaleX || 1;
                const oScaleY = obj.scaleY || 1;
                const oW = (obj.width || 0) * oScaleX;
                const oH = (obj.height || 0) * oScaleY;
                const oL = obj.left || 0;
                const oT = obj.top || 0;
                const oR = oL + oW;
                const oB = oT + oH;
                const oCX = oL + oW / 2;
                const oCY = oT + oH / 2;

                const minY = Math.min(targetT, oT) - 10;
                const maxY = Math.max(targetB, oB) + 10;
                const minX = Math.min(targetL, oL) - 10;
                const maxX = Math.max(targetR, oR) + 10;

                verticalLines.push({ x: oL, y1: minY, y2: maxY });
                verticalLines.push({ x: oCX, y1: minY, y2: maxY });
                verticalLines.push({ x: oR, y1: minY, y2: maxY });

                horizontalLines.push({ y: oT, x1: minX, x2: maxX });
                horizontalLines.push({ y: oCY, x1: minX, x2: maxX });
                horizontalLines.push({ y: oB, x1: minX, x2: maxX });
            }

            // Snap X Axis
            let snappedX = false;
            const targetXPoints = [
                { pos: targetL, offset: 0 },
                { pos: targetCX, offset: targetW / 2 },
                { pos: targetR, offset: targetW },
            ];

            for (const point of targetXPoints) {
                if (snappedX) break;
                for (const line of verticalLines) {
                    if (Math.abs(point.pos - line.x) < SNAP_THRESHOLD) {
                        target.set({ left: line.x - point.offset });
                        target.setCoords();
                        guidelines.push({ x: line.x, y1: line.y1, y2: line.y2 });
                        snappedX = true;
                        break;
                    }
                }
            }

            // Snap Y Axis
            let snappedY = false;
            const targetYPoints = [
                { pos: targetT, offset: 0 },
                { pos: targetCY, offset: targetH / 2 },
                { pos: targetB, offset: targetH },
            ];

            for (const point of targetYPoints) {
                if (snappedY) break;
                for (const line of horizontalLines) {
                    if (Math.abs(point.pos - line.y) < SNAP_THRESHOLD) {
                        target.set({ top: line.y - point.offset });
                        target.setCoords();
                        guidelines.push({ y: line.y, x1: line.x1, x2: line.x2 });
                        snappedY = true;
                        break;
                    }
                }
            }

            fc.requestRenderAll();
        };

        const clearGuidelines = () => {
            guidelines.length = 0;
            const ctx = fc.getTopContext();
            if (ctx) {
                fc.clearContext(ctx);
            }
            fc.requestRenderAll();
        };

        const handleAfterRender = () => {
            const ctx = fc.getTopContext();
            if (!ctx) return;
            fc.clearContext(ctx); // Bersihkan topContext frame sebelumnya agar garis tidak menumpuk

            if (guidelines.length === 0) return;

            ctx.save();
            ctx.strokeStyle = "#c084fc"; // vibrant purple/magenta magnet line
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);

            for (const g of guidelines) {
                ctx.beginPath();
                if (g.x !== undefined) {
                    ctx.moveTo(g.x, g.y1 ?? 0);
                    ctx.lineTo(g.x, g.y2 ?? dimRef.current.height);
                } else if (g.y !== undefined) {
                    ctx.moveTo(g.x1 ?? 0, g.y);
                    ctx.lineTo(g.x2 ?? dimRef.current.width, g.y);
                }
                ctx.stroke();
            }
            ctx.restore();
        };

        fc.on("selection:created", handleSelectionCreated);
        fc.on("selection:updated", handleSelectionUpdated);
        fc.on("selection:cleared", handleSelectionCleared);
        fc.on("selection:cleared", clearGuidelines);
        fc.on("object:added", handleObjectAdded);
        fc.on("object:removed", handleObjectRemoved);
        fc.on("object:modified", handleObjectModified);
        fc.on("object:modified", clearGuidelines);
        fc.on("object:moving", handleObjectMoving);
        fc.on("after:render", handleAfterRender);
        fc.on("mouse:up", clearGuidelines);

        // Double Click to Edit Text directly on Canvas
        const handleMouseDblClick = (e: { target?: FabricObject }) => {
            const target = e.target;
            if (!target) return;
            const type = (target.type || "").toLowerCase();
            if (type.includes("text") || "text" in target) {
                if ("enterEditing" in target && typeof (target as any).enterEditing === "function") {
                    (target as any).enterEditing();
                    fc.requestRenderAll();
                }
            }
        };
        fc.on("mouse:dblclick", handleMouseDblClick);

        return () => {
            fc.off("selection:created", handleSelectionCreated);
            fc.off("selection:updated", handleSelectionUpdated);
            fc.off("selection:cleared", handleSelectionCleared);
            fc.off("selection:cleared", clearGuidelines);
            fc.off("object:added", handleObjectAdded);
            fc.off("object:removed", handleObjectRemoved);
            fc.off("object:modified", handleObjectModified);
            fc.off("object:modified", clearGuidelines);
            fc.off("object:moving", handleObjectMoving);
            fc.off("after:render", handleAfterRender);
            fc.off("mouse:up", clearGuidelines);
            fc.off("mouse:dblclick", handleMouseDblClick);
            fc.dispose();
            fabricRef.current = null;
        };
    }, [onCanvasReady, onSelectionChange, updateObjectsList, onHistorySnapshot]);

    // Keep canvas dimensions in sync with parent state without recreating the
    // canvas. Fabric's setDimensions() resizes both the backing store and the
    // CSS size; existing objects keep their positions (they do NOT scale).
    // Skipping the first run because the init effect above already sized it.
    const skipInitialResize = useRef(true);
    useEffect(() => {
        const fc = fabricRef.current;
        if (!fc) return;
        if (skipInitialResize.current) {
            skipInitialResize.current = false;
            return;
        }
        fc.setDimensions({ width, height });
        fc.requestRenderAll();
    }, [width, height]);

    // Load SVG string onto canvas
    const renderSVG = useCallback(async (svg: string) => {
        const fc = fabricRef.current;
        if (!fc) return;

        suppressRef.current = true;

        try {
            // Clean/sanitize raw SVG string on frontend as safety net
            let cleanSvg = svg.trim();
            const svgMatch = cleanSvg.match(/<svg[\s\S]*?<\/svg>/i);
            if (svgMatch) {
                cleanSvg = svgMatch[0];
            }
            cleanSvg = cleanSvg.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");

            const { objects } = await loadSVGFromString(cleanSvg);

            if (!objects || objects.length === 0) {
                console.warn("SVG parser returned 0 objects. Aborting canvas clear to preserve design.");
                suppressRef.current = false;
                return;
            }

            // Preserve user uploaded images across AI generation turns!
            const userUploadedObjects = fc.getObjects().filter((o) => (o as any).isUserUploaded);

            // ONLY clear canvas AFTER loadSVGFromString successfully parses non-empty objects
            fc.clear();
            fc.backgroundColor = "#ffffff";

            // Add objects in chunks, yielding between chunks so the main thread
            // stays responsive (prevents the "page freezes" when clicking during load).
            const CHUNK_SIZE = 150;
            for (let i = 0; i < objects.length; i += CHUNK_SIZE) {
                const chunk = objects.slice(i, i + CHUNK_SIZE);
                for (const obj of chunk) {
                    if (!obj) continue;

                    // Match ID or name attribute from SVG against user uploaded object name
                    const rawId = String((obj as any).id || (obj as any).name || "").trim().replace(/^@/, "");
                    const matchingUserObj = userUploadedObjects.find(
                        (u) => (u as any).name && String((u as any).name).toLowerCase() === rawId.toLowerCase()
                    );

                    if (matchingUserObj) {
                        // Reposition & rescale user-uploaded object to AI-calculated coordinates!
                        const newLeft = obj.left || 0;
                        const newTop = obj.top || 0;
                        const newWidth = (obj.width || 1) * (obj.scaleX || 1);
                        const newHeight = (obj.height || 1) * (obj.scaleY || 1);

                        const baseWidth = matchingUserObj.width || 1;
                        const baseHeight = matchingUserObj.height || 1;

                        matchingUserObj.set({
                            left: newLeft,
                            top: newTop,
                            scaleX: newWidth / baseWidth,
                            scaleY: newHeight / baseHeight,
                        });
                        matchingUserObj.setCoords();

                        // Discard dummy placeholder from AI so we don't render duplicate shapes
                        continue;
                    }

                    obj.set({
                        selectable: true,
                        hasControls: true,
                        evented: true,
                    });
                    fc.add(obj);

                    // Attach load listener to images so canvas re-renders when async image finishes fetching
                    if (obj.type === "image" || (obj as any)._element) {
                        const imgEl = (obj as any)._element || (obj as any).getElement?.();
                        if (imgEl && imgEl instanceof HTMLImageElement) {
                            imgEl.crossOrigin = "anonymous";
                            if (!imgEl.complete) {
                                imgEl.addEventListener("load", () => {
                                    if (fabricRef.current) {
                                        fabricRef.current.requestRenderAll();
                                        updateObjectsList(fabricRef.current);
                                    }
                                });
                                imgEl.addEventListener("error", () => {
                                    console.warn("External SVG image failed to load:", imgEl.src);
                                });
                            }
                        }
                    }
                }
                // Yield to event loop if more objects remain
                if (i + CHUNK_SIZE < objects.length) {
                    await new Promise((r) => setTimeout(r, 0));
                }
            }

            // Re-add preserved user uploaded objects on top of the newly generated SVG
            for (const userObj of userUploadedObjects) {
                fc.add(userObj);
            }

            // Auto-lock the background element (#6)
            applyBackgroundLock(fc);

            suppressRef.current = false;
            fc.renderAll();

            // Single, final state sync for the whole batch (not one per object)
            updateObjectsList(fc);

            // Schedule delayed re-render passes for network images & gradients
            [100, 300, 700, 1500, 3000].forEach((delay) => {
                setTimeout(() => {
                    if (fabricRef.current) {
                        fabricRef.current.requestRenderAll();
                        updateObjectsList(fabricRef.current);
                    }
                }, delay);
            });

            // Defer the expensive full-canvas serialization so the design paints
            // immediately instead of blocking on JSON.stringify(canvas.toJSON()).
            setTimeout(() => onHistorySnapshot(), 150);
        } catch (error) {
            suppressRef.current = false;
            console.error("Failed to parse SVG:", error);
        }
    }, [applyBackgroundLock, onHistorySnapshot, updateObjectsList]);

    useEffect(() => {
        if (svgString) {
            renderSVG(svgString);
        }
    }, [svgString, renderSVG]);

    return (
        // Visual footprint = canvas pixels × zoom. The inner div is scaled via a
        // CSS transform so the canvas keeps full resolution; Fabric maps pointer
        // coordinates through getBoundingClientRect, so object interaction stays
        // accurate at any zoom level.
        <div
            data-canvas-wrap
            className="border border-[#2a2a38] rounded-lg shadow-2xl shadow-black/60 bg-white"
            style={{
                width: Math.round(width * zoom),
                height: Math.round(height * zoom),
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    width,
                    height,
                    position: "relative",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                }}
            >
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}
