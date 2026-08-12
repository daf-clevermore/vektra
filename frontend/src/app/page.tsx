"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, FabricObject } from "fabric";
import DesignCanvas from "@/components/DesignCanvas";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar, { ChatMessage } from "@/components/RightSidebar";
import ProjectDrawer from "@/components/ProjectDrawer";
import Dashboard from "@/components/Dashboard";
import {
    createNewProject,
    deleteProject,
    duplicateProject,
    getActiveProjectId,
    getAllProjects,
    ProjectSession,
    saveProject,
    setActiveProjectId,
    toggleFavoriteProject,
    toggleTrashProject,
} from "@/utils/projectStorage";

// Canvas size presets
const CANVAS_PRESETS = [
    { label: "1:1 (Square)", width: 800, height: 800 },
    { label: "16:9 (Widescreen)", width: 1280, height: 720 },
    { label: "4:3 (Standard)", width: 800, height: 600 },
    { label: "3:2 (Photo)", width: 900, height: 600 },
    { label: "9:16 (Mobile)", width: 720, height: 1280 },
    { label: "A4 (Portrait)", width: 595, height: 842 },
    { label: "A4 (Landscape)", width: 842, height: 595 },
];

export default function Home() {
    // Project switching loading indicator state
    const [projectLoading, setProjectLoading] = useState(false);
    // Toast notification state (menggantikan alert() native)
    const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ── Chat state (menggantikan single prompt + lastPrompt) ──────────────
    // chatHistory berisi semua turn user dan assistant secara berurutan.
    // State TIDAK pernah dihapus otomatis — user bisa clear manual.
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [svgData, setSvgData] = useState<string | null>(null);
    const [canvas, setCanvas] = useState<Canvas | null>(null);
    const [objects, setObjects] = useState<FabricObject[]>([]);
    const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
    const [history, setHistory] = useState<string[]>([]);
    const [redoStack, setRedoStack] = useState<string[]>([]);
    const [suppressHistory, setSuppressHistory] = useState(false);
    // View Mode: 'dashboard' vs 'editor'
    const [viewMode, setViewMode] = useState<"dashboard" | "editor">("dashboard");

    // Canvas dimension state
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [widthInput, setWidthInput] = useState("800");
    const [heightInput, setHeightInput] = useState("600");

    // Workspace viewport (used to compute "Fit" zoom) + current zoom factor
    const workspaceRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);

    // Pinch to zoom (trackpad 2-finger pinch) & Ctrl+Wheel zoom handler
    useEffect(() => {
        const el = workspaceRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = -e.deltaY;
                const zoomFactor = delta > 0 ? 0.05 : -0.05;
                setZoom((prev) => {
                    const next = Math.min(3, Math.max(0.1, prev + zoomFactor));
                    return Math.round(next * 100) / 100;
                });
            }
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            el.removeEventListener("wheel", handleWheel);
        };
    }, [viewMode]);

    // Canvas Size popover: open state + outside-click / Escape to close
    const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
    const sizeMenuRef = useRef<HTMLDivElement>(null);

    // Alignment tools popover
    const [alignMenuOpen, setAlignMenuOpen] = useState(false);
    const alignMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!sizeMenuOpen) return;
        const onDocPointerDown = (e: PointerEvent) => {
            if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
                setSizeMenuOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSizeMenuOpen(false);
        };
        document.addEventListener("pointerdown", onDocPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onDocPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [sizeMenuOpen]);

    // Alignment popover: close on outside-click or Escape
    useEffect(() => {
        if (!alignMenuOpen) return;
        const onDocPointerDown = (e: PointerEvent) => {
            if (alignMenuRef.current && !alignMenuRef.current.contains(e.target as Node)) {
                setAlignMenuOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setAlignMenuOpen(false);
        };
        document.addEventListener("pointerdown", onDocPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onDocPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [alignMenuOpen]);

    const canvasRef = useRef<Canvas | null>(null);

    // Lock properties schema to include in JSON history snapshots
    const CUSTOM_LOCK_PROPS = [
        "id",
        "name",
        "isLocked",
        "selectable",
        "evented",
        "lockMovementX",
        "lockMovementY",
        "lockRotation",
        "lockScalingX",
        "lockScalingY",
        "hasControls",
        "hasBorders",
        "isUserUploaded",
    ];

    const syncLockStates = (fc: Canvas) => {
        fc.getObjects().forEach((obj) => {
            const isLocked = Boolean(
                (obj as any).isLocked === true ||
                obj.lockMovementX === true ||
                (obj as any).selectable === false
            );
            (obj as any).isLocked = isLocked;
            obj.set(
                isLocked
                    ? {
                          selectable: false,
                          evented: false, // Allows box-select marquee over locked background elements!
                          lockMovementX: true,
                          lockMovementY: true,
                          lockRotation: true,
                          lockScalingX: true,
                          lockScalingY: true,
                          hasControls: false,
                          hasBorders: false,
                      }
                    : {
                          selectable: true,
                          evented: true,
                          lockMovementX: false,
                          lockMovementY: false,
                          lockRotation: false,
                          lockScalingX: false,
                          lockScalingY: false,
                          hasControls: true,
                          hasBorders: true,
                      }
            );
        });
        fc.requestRenderAll();
    };

    // Canvas readiness
    const handleCanvasReady = useCallback(async (fc: Canvas) => {

        canvasRef.current = fc;
        setCanvas(fc);

        // Load active project's canvasJson when editor canvas mounts
        const activeId = getActiveProjectId();
        if (activeId) {
            const all = getAllProjects();
            const found = all.find((p) => p.id === activeId);
            if (found) {
                // 1. Try loading non-empty canvasJson
                if (found.canvasJson && Array.isArray(found.canvasJson.objects) && found.canvasJson.objects.length > 0) {
                    await fc.loadFromJSON(found.canvasJson);
                    syncLockStates(fc);
                    setObjects([...fc.getObjects()]);
                    setHistory([JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS))]);
                    return;
                }

                // 2. Fallback: if canvasJson has 0 objects, but chatHistory contains SVG, re-render the SVG automatically!
                if (found.chatHistory && found.chatHistory.length > 0) {
                    for (let i = found.chatHistory.length - 1; i >= 0; i--) {
                        const msg = found.chatHistory[i];
                        if (msg.role === "assistant" && msg.content.trimStart().startsWith("<svg")) {
                            setSvgData(msg.content);
                            return;
                        }
                    }
                }
            }
        }

        syncLockStates(fc);
        setObjects(fc.getObjects());
        setHistory([JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS))]);
    }, []);

    // Sync objects & selection state from canvas
    const handleSelectionChange = useCallback((sel: FabricObject | null) => {

        setSelectedObject(sel);
    }, []);

    const handleObjectsChange = useCallback((objs: FabricObject[]) => {

        setObjects(objs);
    }, []);

    // Capture the current canvas state onto the undo stack.
    const handleHistorySnapshot = useCallback(() => {

        const fc = canvasRef.current;
        if (!fc) return;
        const snap = JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS));
        setHistory((prev) => {
            if (prev[prev.length - 1] === snap) return prev;
            const next = [...prev, snap];
            if (next.length > 51) next.shift(); // cap stack size
            return next;
        });
        setRedoStack([]); // Aksi baru membatalkan opsi redo
    }, []);

    // Project Sessions State
    const [projects, setProjects] = useState<ProjectSession[]>([]);
    const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
    const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);

    // Initial load project sessions from localStorage
    useEffect(() => {
        const all = getAllProjects();
        setProjects(all);
        const activeId = getActiveProjectId();
        if (activeId) {
            const found = all.find((p) => p.id === activeId);
            if (found) {
                setActiveProjectIdState(found.id);
                setCanvasWidth(found.canvasWidth);
                setCanvasHeight(found.canvasHeight);
                setChatHistory(found.chatHistory || []);
                return;
            }
        }
        if (all.length === 0) {
            const p = createNewProject("Project Pertama");
            setProjects([p]);
            setActiveProjectIdState(p.id);
        }
    }, []);

    // Generate thumbnail SVG dari chatHistory (SVG AI terakhir yang di-generate)
    const getLatestSvgFromHistory = (chatMsgs: { role: string; content: string }[]): string | null => {
        for (let i = chatMsgs.length - 1; i >= 0; i--) {
            const msg = chatMsgs[i];
            if (msg.role === "assistant" && msg.content.trimStart().startsWith("<svg")) {
                return msg.content;
            }
        }
        return null;
    };

    // Auto-save active project whenever canvas objects or chat history change
    useEffect(() => {
        if (viewMode !== "editor" || !activeProjectId || !canvasRef.current) return;
        const fc = canvasRef.current;
        const currentObjects = fc.getObjects();

        const all = getAllProjects();
        const current = all.find((p) => p.id === activeProjectId);
        if (!current) return;

        // Save serialized canvas JSON with lock properties schema
        const currentJson = fc.toObject(CUSTOM_LOCK_PROPS);

        // Safety: if canvas has 0 objects BUT project previously had objects & chatHistory, don't wipe it out prematurely
        const hasPrevObjects = current.canvasJson?.objects && Array.isArray(current.canvasJson.objects) && current.canvasJson.objects.length > 0;
        if (currentObjects.length === 0 && hasPrevObjects && suppressHistory) {
            return;
        }

        // Auto-generate thumbnail from the latest SVG in chatHistory
        const thumbnailSvg = getLatestSvgFromHistory(chatHistory) ?? current.thumbnailSvg ?? undefined;

        const updated: ProjectSession = {
            ...current,
            canvasWidth,
            canvasHeight,
            canvasJson: currentJson,
            chatHistory,
            thumbnailSvg,
            updatedAt: new Date().toISOString(),
        };
        saveProject(updated);
        setProjects(getAllProjects());
    }, [objects, chatHistory, canvasWidth, canvasHeight, activeProjectId, viewMode, suppressHistory]);

    // Project CRUD Handlers
    const handleCreateProject = () => {
        const p = createNewProject(`Project ${projects.length + 1}`, canvasWidth, canvasHeight);
        setProjects(getAllProjects());
        setActiveProjectIdState(p.id);
        setChatHistory([]);
        setSelectedObject(null);
        setSvgData(null);
        setProjectDrawerOpen(false);

        const fc = canvasRef.current;
        if (fc && viewMode === "editor") {
            fc.discardActiveObject();
            fc.clear();
            fc.backgroundColor = "#ffffff";
            fc.requestRenderAll();
            setObjects([]);
            setHistory([JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS))]);
            setRedoStack([]);
        } else {
            canvasRef.current = null;
            setCanvas(null);
            setObjects([]);
            setViewMode("editor");
        }
    };

    const handleSelectProject = async (id: string) => {
        const all = getAllProjects();
        const found = all.find((p) => p.id === id);
        if (!found) return;

        setActiveProjectId(id);
        setActiveProjectIdState(id);
        setCanvasWidth(found.canvasWidth);
        setCanvasHeight(found.canvasHeight);
        setWidthInput(String(found.canvasWidth));
        setHeightInput(String(found.canvasHeight));
        setChatHistory(found.chatHistory || []);
        setSvgData(null);
        setSelectedObject(null);
        setProjectDrawerOpen(false);

        const fc = canvasRef.current;

        // If Editor canvas is ALREADY mounted on DOM (switching projects via topbar Drawer):
        if (fc && viewMode === "editor") {
            setProjectLoading(true);
            setSuppressHistory(true);
            try {
                fc.discardActiveObject();

                // 1. If target project has non-empty canvasJson, load it directly onto live canvas
                if (found.canvasJson && Array.isArray(found.canvasJson.objects) && found.canvasJson.objects.length > 0) {
                    await fc.loadFromJSON(found.canvasJson);
                    syncLockStates(fc);
                    setObjects([...fc.getObjects()]);
                    setHistory([JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS))]);
                    setRedoStack([]);
                }
                // 2. Else if target project has SVG in chatHistory, fallback to rendering the SVG
                else if (found.chatHistory && found.chatHistory.length > 0) {
                    let hasSvg = false;
                    for (let i = found.chatHistory.length - 1; i >= 0; i--) {
                        const msg = found.chatHistory[i];
                        if (msg.role === "assistant" && msg.content.trimStart().startsWith("<svg")) {
                            setSvgData(msg.content);
                            hasSvg = true;
                            break;
                        }
                    }
                    if (!hasSvg) {
                        fc.clear();
                        fc.backgroundColor = "#ffffff";
                        fc.requestRenderAll();
                        setObjects([]);
                        setHistory([JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS))]);
                        setRedoStack([]);
                    }
                }
                // 3. Else clear live canvas for empty target project
                else {
                    fc.clear();
                    fc.backgroundColor = "#ffffff";
                    fc.requestRenderAll();
                    setObjects([]);
                    setHistory([JSON.stringify(fc.toObject(CUSTOM_LOCK_PROPS))]);
                    setRedoStack([]);
                }
            } finally {
                setSuppressHistory(false);
                setProjectLoading(false);
            }
            return;
        }

        // If Editor canvas is NOT mounted (coming from Dashboard mode):
        canvasRef.current = null;
        setCanvas(null);

        // Fallback: Check if project has SVG in chatHistory when canvasJson is empty
        if ((!found.canvasJson || !found.canvasJson.objects || found.canvasJson.objects.length === 0) && found.chatHistory) {
            for (let i = found.chatHistory.length - 1; i >= 0; i--) {
                const msg = found.chatHistory[i];
                if (msg.role === "assistant" && msg.content.trimStart().startsWith("<svg")) {
                    setSvgData(msg.content);
                    break;
                }
            }
        }

        setViewMode("editor");
    };

    const handleRenameProject = (id: string, newName: string) => {
        const found = projects.find((p) => p.id === id);
        if (!found) return;
        const updated = { ...found, name: newName };
        saveProject(updated);
        setProjects(getAllProjects());
    };

    const handleDeleteProject = (id: string) => {
        const remaining = deleteProject(id);
        setProjects(remaining);
        if (activeProjectId === id) {
            if (remaining.length > 0) {
                handleSelectProject(remaining[0].id);
            } else {
                handleCreateProject();
            }
        }
    };

    // ---- Export semua proyek sebagai file JSON ----
    // ---- Helper: tampilkan toast notification ----
    const showToast = (type: "success" | "error", text: string) => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 3500);
    };

    // ---- Export semua proyek sebagai file JSON ----
    const handleExportProjects = () => {
        const all = getAllProjects();
        const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vektra_projects_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("success", `${all.length} proyek berhasil diekspor!`);
    };

    // ---- Import proyek dari file JSON ----
    const handleImportProjects = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const imported: ProjectSession[] = JSON.parse(evt.target?.result as string);
                if (!Array.isArray(imported)) throw new Error("Format tidak valid");
                let newCount = 0;
                imported.forEach((p) => {
                    // Hanya impor jika belum ada (berdasarkan id)
                    const existing = getAllProjects().find((ex) => ex.id === p.id);
                    if (!existing) { saveProject(p); newCount++; }
                });
                setProjects(getAllProjects());
                showToast("success", `${newCount} proyek baru berhasil diimpor!`);
            } catch {
                showToast("error", "Gagal mengimpor: format file tidak valid.");
            }
        };
        reader.readAsText(file);
        // Reset input supaya bisa import file yang sama lagi
        e.target.value = "";
    };

    // ---- Upload Image Handler ----
    const handleUploadImage = useCallback((dataUrl: string) => {
        const fc = canvasRef.current;
        if (!fc) return;

        FabricImage.fromURL(dataUrl).then((img) => {
            const maxWidth = fc.width * 0.6;
            const maxHeight = fc.height * 0.6;
            if (img.width && img.width > maxWidth) {
                img.scaleToWidth(maxWidth);
            }
            if (img.height && img.getScaledHeight() > maxHeight) {
                img.scaleToHeight(maxHeight);
            }

            const imgCount = fc.getObjects().filter((o) => o.type?.includes("image")).length + 1;
            (img as any).name = `gambar_${imgCount}`;
            (img as any).isUserUploaded = true;

            img.set({
                left: (fc.width - img.getScaledWidth()) / 2,
                top: (fc.height - img.getScaledHeight()) / 2,
            });

            fc.add(img);
            fc.setActiveObject(img);
            fc.requestRenderAll();
            setObjects([...fc.getObjects()]);
            setSelectedObject(img);
            handleHistorySnapshot();
        });
    }, [handleHistorySnapshot]);

    // ---- Rename Layer Object Handler ----
    const handleRenameObject = useCallback((obj: FabricObject, newName: string) => {
        const fc = canvasRef.current;
        if (!fc) return;

        (obj as any).name = newName;
        fc.requestRenderAll();
        setObjects([...fc.getObjects()]);
        handleHistorySnapshot();
    }, [handleHistorySnapshot]);

    // ── Conversational Generate ──────────────────────────────────────────
    async function handleSendMessage() {
        const trimmed = chatInput.trim();
        if (!trimmed || loading) return;


        setLoading(true);
        setError(null);

        const userMsg: ChatMessage = { role: "user", content: trimmed };
        const updatedHistory = [...chatHistory, userMsg];
        setChatHistory(updatedHistory);
        setChatInput("");

        const canvasElements = objects.map((obj) => ({
            name: String((obj as any).name || "").trim(),
            type: obj.type || "object",
            width: (obj.width || 0) * (obj.scaleX || 1),
            height: (obj.height || 0) * (obj.scaleY || 1),
            x: obj.left || 0,
            y: obj.top || 0,
            text: "text" in obj ? String((obj as any).text || "") : "",
        }));

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const res = await fetch(`${apiBaseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    canvas_width: canvasWidth,
                    canvas_height: canvasHeight,
                    canvas_elements: canvasElements,
                    messages: updatedHistory.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.detail || `Server error: ${res.status}`);
            }

            const data = await res.json();
            const svg: string = data.svg;

            // Update canvas
            setSvgData(svg);

            // Append assistant turn — SVG masuk ke history agar LLM
            // bisa merujuk desain sebelumnya saat refinement berikutnya
            const assistantMsg: ChatMessage = { role: "assistant", content: svg };
            const newHistory = [...updatedHistory, assistantMsg];
            setChatHistory(newHistory);

            // Auto-rename proyek dari prompt AI pertama
            // Hanya rename jika ini benar-benar generate pertama KALI untuk proyek ini
            // (chatHistory project di-storage sebelumnya masih kosong / belum ada SVG)
            if (activeProjectId && updatedHistory.filter(m => m.role === "user").length === 1) {
                const allP = getAllProjects();
                const proj = allP.find(p => p.id === activeProjectId);
                // Aman rename hanya jika: (1) chatHistory di-storage masih kosong, dan (2) belum ada thumbnailSvg
                // Ini memastikan kita tidak overwrite nama yang sudah diubah user secara manual
                const hasNeverGenerated = proj && (!proj.chatHistory || proj.chatHistory.length === 0) && !proj.thumbnailSvg;
                if (proj && hasNeverGenerated) {
                    // Ambil 4 kata pertama dari prompt sebagai nama proyek
                    const words = trimmed.split(/\s+/).slice(0, 4).join(" ");
                    const autoName = words.charAt(0).toUpperCase() + words.slice(1);
                    const updatedProj = { ...proj, name: autoName };
                    saveProject(updatedProj);
                    setProjects(getAllProjects());
                }
            }
        } catch (err) {
            let errMsg = "Terjadi kesalahan. Silakan coba lagi.";
            if (err instanceof TypeError && err.message.includes("fetch")) {
                errMsg = "❌ Tidak dapat terhubung ke server AI. Pastikan backend berjalan di localhost:8000.";
            } else if (err instanceof Error) {
                if (err.message.includes("502") || err.message.includes("503")) {
                    errMsg = "⚠️ Server AI sedang tidak tersedia. Coba lagi beberapa saat.";
                } else if (err.message.includes("LLM")) {
                    errMsg = "⚠️ AI tidak merespons. Coba sederhanakan prompt Anda.";
                } else {
                    errMsg = err.message;
                }
            }
            setError(errMsg);
            // Hapus pesan user terakhir dari history jika gagal (hindari ghost turn)
            setChatHistory((prev) => prev.slice(0, -1));
        } finally {
            setLoading(false);
        }
    }

    // Clear seluruh conversation
    function handleClearChat() {
        setChatHistory([]);
        setChatInput("");
        setError(null);
    }

    // ---- Layer Selection ----
    function handleSelectObject(obj: FabricObject) {

        if (!canvas) return;
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        setSelectedObject(obj);
    }

    // ---- Layer Deletion ----
    function handleDeleteObject(obj: FabricObject) {

        if (!canvas) return;

        if (canvas.getActiveObject() === obj) {
            canvas.discardActiveObject();
            setSelectedObject(null);
        }
        canvas.remove(obj);
        canvas.requestRenderAll();
        setObjects([...canvas.getObjects()]);
    }

    // ---- Layer Reordering (drag & drop) ----
    function handleReorderLayer(fromCanvasIndex: number, toCanvasIndex: number) {

        if (!canvas || fromCanvasIndex === toCanvasIndex) return;
        const objs = canvas.getObjects();
        const obj = objs[fromCanvasIndex];
        if (!obj) return;
        canvas.moveObjectTo(obj, toCanvasIndex);
        canvas.requestRenderAll();
        setObjects([...canvas.getObjects()]);
        handleHistorySnapshot();
    }

    // ---- Lock / Unlock Layer ----
    function handleToggleLock(obj: FabricObject) {

        if (!canvas) return;
        const isCurrentlyLocked = Boolean((obj as any).isLocked || (obj as any).lockMovementX);
        const newLocked = !isCurrentlyLocked;

        (obj as any).isLocked = newLocked;
        obj.set(
            newLocked
                ? {
                      selectable: false,
                      evented: false, // Allows drag-select marquee over locked background elements!
                      lockMovementX: true,
                      lockMovementY: true,
                      lockRotation: true,
                      lockScalingX: true,
                      lockScalingY: true,
                      hasControls: false,
                      hasBorders: false,
                  }
                : {
                      selectable: true,
                      evented: true,
                      lockMovementX: false,
                      lockMovementY: false,
                      lockRotation: false,
                      lockScalingX: false,
                      lockScalingY: false,
                      hasControls: true,
                      hasBorders: true,
                  }
        );

        if (newLocked) {
            canvas.discardActiveObject();
        }
        canvas.requestRenderAll();
        setObjects([...canvas.getObjects()]);
        setSelectedObject(newLocked ? null : obj);
        handleHistorySnapshot();
    }

    // ---- Deselect All ----
    function handleDeselect() {

        if (!canvas) return;
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setSelectedObject(null);
    }

    // ---- Undo (load previous JSON state) ----
    const handleUndo = useCallback(async () => {

        if (!canvasRef.current || history.length <= 1) return;
        setSuppressHistory(true);
        try {
            const currentState = history[history.length - 1];
            const nextHistory = history.slice(0, -1);
            const target = nextHistory[nextHistory.length - 1];

            setHistory(nextHistory);
            setRedoStack((prev) => [...prev, currentState]);

            await new Promise((resolve) => setTimeout(resolve, 0));
            await canvasRef.current.loadFromJSON(target);
            syncLockStates(canvasRef.current);
            setObjects([...canvasRef.current.getObjects()]);
            handleDeselect();
        } finally {
            setSuppressHistory(false);
        }
    }, [history, handleDeselect]);

    // ---- Redo (load next JSON state) ----
    const handleRedo = useCallback(async () => {

        if (!canvasRef.current || redoStack.length === 0) return;
        setSuppressHistory(true);
        try {
            const target = redoStack[redoStack.length - 1];
            const nextRedoStack = redoStack.slice(0, -1);

            setRedoStack(nextRedoStack);
            setHistory((prev) => [...prev, target]);

            await new Promise((resolve) => setTimeout(resolve, 0));
            await canvasRef.current.loadFromJSON(target);
            syncLockStates(canvasRef.current);
            setObjects([...canvasRef.current.getObjects()]);
            handleDeselect();
        } finally {
            setSuppressHistory(false);
        }
    }, [redoStack, handleDeselect]);

    // ---- Group / Ungroup Elements ----
    function handleGroup() {
        const fc = canvasRef.current;
        if (!fc) return;
        const activeObj = fc.getActiveObject();
        if (!activeObj) return;

        if ("toGroup" in activeObj && typeof (activeObj as any).toGroup === "function") {
            const group = (activeObj as any).toGroup();
            fc.setActiveObject(group);
            fc.requestRenderAll();
            setObjects([...fc.getObjects()]);
            setSelectedObject(group);
            handleHistorySnapshot();
        }
    }

    function handleUngroup() {
        const fc = canvasRef.current;
        if (!fc) return;
        const activeObj = fc.getActiveObject();
        if (!activeObj) return;

        if ("toActiveSelection" in activeObj && typeof (activeObj as any).toActiveSelection === "function") {
            const activeSel = (activeObj as any).toActiveSelection();
            fc.setActiveObject(activeSel);
            fc.requestRenderAll();
            setObjects([...fc.getObjects()]);
            setSelectedObject(fc.getActiveObject() || null);
            handleHistorySnapshot();
        }
    }

    // ---- Alignment Tools (align selected objects) ----
    const handleAlign = useCallback((direction: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
        const fc = canvasRef.current;
        if (!fc) return;
        const activeObj = fc.getActiveObject();
        if (!activeObj) return;

        const cw = fc.width || canvasWidth;
        const ch = fc.height || canvasHeight;

        // Multi-select via ActiveSelection
        const objs = "getObjects" in activeObj ? (activeObj as any).getObjects() : [activeObj];

        if (objs.length < 2) {
            // Single object: align relative to canvas edges menggunakan bounding rect
            const objWidth = activeObj.getScaledWidth();
            const objHeight = activeObj.getScaledHeight();
            // Reset ke originX/Y "left"/"top" untuk konsistensi
            if (direction === "left") {
                activeObj.set({ left: 0, originX: "left" });
            } else if (direction === "center") {
                activeObj.set({ left: Math.round((cw - objWidth) / 2), originX: "left" });
            } else if (direction === "right") {
                activeObj.set({ left: Math.round(cw - objWidth), originX: "left" });
            } else if (direction === "top") {
                activeObj.set({ top: 0, originY: "top" });
            } else if (direction === "middle") {
                activeObj.set({ top: Math.round((ch - objHeight) / 2), originY: "top" });
            } else if (direction === "bottom") {
                activeObj.set({ top: Math.round(ch - objHeight), originY: "top" });
            }
            activeObj.setCoords();
        } else {
            // Multi-select: align relative to selection bounding box
            const selBound = activeObj.getBoundingRect();
            objs.forEach((obj: any) => {
                const objBound = obj.getBoundingRect();
                if (direction === "left") {
                    obj.set({ left: obj.left - (objBound.left - selBound.left) });
                } else if (direction === "center") {
                    obj.set({ left: obj.left + (selBound.left + selBound.width / 2) - (objBound.left + objBound.width / 2) });
                } else if (direction === "right") {
                    obj.set({ left: obj.left + (selBound.left + selBound.width) - (objBound.left + objBound.width) });
                } else if (direction === "top") {
                    obj.set({ top: obj.top - (objBound.top - selBound.top) });
                } else if (direction === "middle") {
                    obj.set({ top: obj.top + (selBound.top + selBound.height / 2) - (objBound.top + objBound.height / 2) });
                } else if (direction === "bottom") {
                    obj.set({ top: obj.top + (selBound.top + selBound.height) - (objBound.top + objBound.height) });
                }
                obj.setCoords();
            });
        }

        fc.requestRenderAll();
        setObjects([...fc.getObjects()]);
        handleHistorySnapshot();
    }, [canvasWidth, canvasHeight, handleHistorySnapshot]);

    // ── Global Keyboard Shortcuts ──────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 1. Safety Check: abaikan jika sedang fokus mengetik pada input/textarea/contentEditable
            const activeEl = document.activeElement;
            if (activeEl) {
                const tagName = activeEl.tagName.toLowerCase();
                if (
                    tagName === "input" ||
                    tagName === "textarea" ||
                    (activeEl instanceof HTMLElement && activeEl.isContentEditable) ||
                    activeEl.getAttribute("contenteditable") === "true"
                ) {
                    return;
                }
            }

            const fc = canvasRef.current;
            if (!fc) return;

            // 2. Delete / Backspace: Hapus objek aktif yang dipilih di canvas
            if (e.key === "Delete" || e.key === "Backspace") {
                const activeObjs = fc.getActiveObjects();
                if (activeObjs.length > 0) {
                    e.preventDefault();
                    fc.discardActiveObject();
                    activeObjs.forEach((obj) => fc.remove(obj));
                    fc.requestRenderAll();
                    setObjects([...fc.getObjects()]);
                    setSelectedObject(null);
                    handleHistorySnapshot();
                }
                return;
            }

            // 3. Ctrl + Z / Cmd + Z: Undo | Ctrl + Y / Cmd + Y / Ctrl + Shift + Z: Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                e.preventDefault();
                handleRedo();
                return;
            }

            // 4. Ctrl + G / Cmd + G: Group (Shift + Ctrl + G: Ungroup)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
                e.preventDefault();
                if (e.shiftKey) {
                    handleUngroup();
                } else {
                    handleGroup();
                }
                return;
            }

            // 5. Arrow Keys: Geser elemen 1px (10px jika menahan Shift)
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                const activeObjs = fc.getActiveObjects();
                if (activeObjs.length > 0) {
                    e.preventDefault(); // Cegah scroll halaman web
                    const step = e.shiftKey ? 10 : 1;
                    let dx = 0;
                    let dy = 0;
                    if (e.key === "ArrowUp") dy = -step;
                    if (e.key === "ArrowDown") dy = step;
                    if (e.key === "ArrowLeft") dx = -step;
                    if (e.key === "ArrowRight") dx = step;

                    activeObjs.forEach((obj) => {
                        obj.set({
                            left: (obj.left || 0) + dx,
                            top: (obj.top || 0) + dy,
                        });
                        obj.setCoords();
                    });

                    fc.requestRenderAll();
                    setObjects([...fc.getObjects()]);
                    handleHistorySnapshot();
                }
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleUndo, handleRedo, handleHistorySnapshot]);


    // ---- Property Update from Right Sidebar ----
    function handlePropertyChange(property: string, value: unknown) {

        if (!canvas || !selectedObject) return;

        if (property === "fill" && typeof value === "string") {
            selectedObject.set({ fill: value });
        } else if (property === "text" && typeof value === "string") {
            (selectedObject as any).set("text", value);
            if (typeof (selectedObject as any).initDimensions === "function") {
                (selectedObject as any).initDimensions();
            }
            selectedObject.setCoords();
        } else if (property === "left" || property === "top") {
            const num = Number(value);
            if (!Number.isFinite(num)) return;
            selectedObject.set({ [property]: num });
            selectedObject.setCoords();
        } else if (property === "width" || property === "height") {
            const num = Number(value);
            if (!Number.isFinite(num) || num <= 0) return;
            const base = property === "width" ? selectedObject.width : selectedObject.height;
            if (!base) return;
            const scale = num / base;
            if (property === "width") selectedObject.set({ scaleX: scale });
            else selectedObject.set({ scaleY: scale });
            selectedObject.setCoords();
        }

        canvas.requestRenderAll();
        setSelectedObject(selectedObject);
        setObjects([...canvas.getObjects()]);
        handleHistorySnapshot();
    }

    // ---- Exports ----
    function handleExportPNG() {

        if (!canvas) return;
        const dataUrl = canvas.toDataURL({
            format: "png",
            multiplier: 2,
        });
        const link = document.createElement("a");
        link.download = "design.png";
        link.href = dataUrl;
        link.click();
    }

    function handleExportSVG() {
        if (!canvas) return;
        const svg = canvas.toSVG();
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = "design.svg";
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    // ---- Canvas Resize (real-time, no Apply button) ----
    // Dimensions change immediately as the user picks a preset or types in the
    // W/H inputs. Existing elements KEEP their current size/position (they do
    // NOT auto-scale); a warning is surfaced in the UI whenever objects exist.
    const handleWidthInput = (val: string) => {
        setWidthInput(val);
        const n = Number(val);
        if (val !== "" && Number.isFinite(n) && n >= 50 && n <= 5000) {
            setCanvasWidth(n);
        }
    };

    const handleHeightInput = (val: string) => {
        setHeightInput(val);
        const n = Number(val);
        if (val !== "" && Number.isFinite(n) && n >= 50 && n <= 5000) {
            setCanvasHeight(n);
        }
    };

    const applyCanvasSize = (w: number, h: number) => {
        if (!Number.isFinite(w) || !Number.isFinite(h)) return;
        if (w < 50 || h < 50 || w > 5000 || h > 5000) return; // ignore in-progress input
        setCanvasWidth(w);
        setCanvasHeight(h);
        setWidthInput(String(w));
        setHeightInput(String(h));
        setError(null);
    };

    // Fit zoom = the smallest ratio that makes the canvas fit the workspace
    // viewport (capped at 100% so we never upscale just to fit).
    const fitCanvasTo = (w: number, h: number) => {
        const el = workspaceRef.current;
        if (!el) return;
        const availW = el.clientWidth - 48; // p-6 padding (24px each side)
        const availH = el.clientHeight - 48;
        const fitted = Math.min(availW / w, availH / h, 1);
        setZoom(Math.max(0.05, Math.round(fitted * 100) / 100));
    };

    const handlePresetChange = (value: string) => {
        const [w, h] = value.split("x").map(Number);
        if (!Number.isFinite(w) || !Number.isFinite(h)) return;
        applyCanvasSize(w, h);
        fitCanvasTo(w, h); // auto-fit so presets are always fully visible
    };

    // Shared dark button styles
    const darkUtilBtn =
        "px-3 py-1.5 text-xs font-medium text-[#c0c0d0] bg-[#222230] hover:bg-[#2a2a3a] border border-[#2a2a38] hover:border-[#3a3a50] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5";

    if (viewMode === "dashboard") {
        return (
            <Dashboard
                projects={projects}
                onSelectProject={(id) => {
                    handleSelectProject(id);
                    setViewMode("editor");
                }}
                onCreateProject={(name, w, h) => {
                    const targetW = w || 800;
                    const targetH = h || 600;
                    const p = createNewProject(name, targetW, targetH);
                    setProjects(getAllProjects());
                    setActiveProjectIdState(p.id);
                    setCanvasWidth(targetW);
                    setCanvasHeight(targetH);
                    setWidthInput(String(targetW));
                    setHeightInput(String(targetH));
                    setChatHistory([]);
                    canvasRef.current = null;
                    setCanvas(null);
                    setObjects([]);
                    setSelectedObject(null);
                    setViewMode("editor");
                }}
                onRenameProject={(id, newName) => handleRenameProject(id, newName)}
                onDeleteProject={(id) => {
                    deleteProject(id);
                    setProjects(getAllProjects());
                }}
                onDuplicateProject={(id) => {
                    duplicateProject(id);
                    setProjects(getAllProjects());
                }}
                onToggleFavorite={(id) => {
                    toggleFavoriteProject(id);
                    setProjects(getAllProjects());
                }}
                onToggleTrash={(id) => {
                    toggleTrashProject(id);
                    setProjects(getAllProjects());
                }}
                onExportProjects={handleExportProjects}
                onImportProjects={handleImportProjects}
            />
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[#111115] overflow-hidden select-none">
            {/* ── Global Toast Notification ─────────────────────────── */}
            {toastMessage && (
                <div
                    className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium transition-all duration-300 ${
                        toastMessage.type === "success"
                            ? "bg-emerald-900/90 border-emerald-500/40 text-emerald-300 shadow-emerald-900/50"
                            : "bg-red-900/90 border-red-500/40 text-red-300 shadow-red-900/50"
                    } backdrop-blur-md`}
                >
                    {toastMessage.type === "success" ? (
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                    {toastMessage.text}
                </div>
            )}
            {/* ── Top Header Bar ──────────────────────────────────────── */}
            <header className="h-14 flex items-center justify-between px-5 bg-[#16161e] border-b border-[#2a2a38] shrink-0">
                {/* Logo & Back to Dashboard */}
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => setViewMode("dashboard")}
                        title="Kembali ke Dashboard Utama"
                        className="flex items-center gap-2.5 group focus:outline-none"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-900/40 group-hover:scale-105 transition-transform">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828L13 15"
                                />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h1 className="text-sm font-bold text-[#e8e8f0] leading-tight tracking-tight group-hover:text-violet-300 transition-colors">
                                VEKTRA
                            </h1>
                            <p className="text-[10px] text-[#6b6b80] leading-tight flex items-center gap-1">
                                <span>← Dashboard</span>
                            </p>
                        </div>
                    </button>
                </div>

                {/* ── Center — active conversation status ── */}
                <div className="flex-1 flex items-center justify-center min-w-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#222230]/60 border border-[#2a2a38]">
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                loading ? "bg-amber-400 animate-pulse" : chatHistory.length > 0 ? "bg-emerald-400" : "bg-[#3a3a50]"
                            }`}
                        />
                        <span className="text-xs text-[#9090a8] font-medium">
                            {loading
                                ? "Generating design…"
                                : chatHistory.length > 0
                                ? `${Math.floor(chatHistory.length / 2)} turn${Math.floor(chatHistory.length / 2) !== 1 ? "s" : ""} · ${chatHistory.filter((m) => m.role === "user").slice(-1)[0]?.content.slice(0, 40) ?? ""}…`
                                : "Start chatting in the AI Chat panel →"}
                        </span>
                    </div>
                </div>

                {/* ── Utility Actions ───────────────────────────────────── */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Sesi Project button */}
                    <button
                        onClick={() => setProjectDrawerOpen(true)}
                        title="Kelola Sesi Project & Riwayat Desain"
                        className={darkUtilBtn}
                    >
                        <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className="max-w-[120px] truncate">
                            {projects.find((p) => p.id === activeProjectId)?.name || "Sesi Project"}
                        </span>
                    </button>

                    {/* Canvas Size button + popover */}
                    <div ref={sizeMenuRef} className="relative">
                        <button
                            onClick={() => setSizeMenuOpen((o) => !o)}
                            disabled={loading}
                            title="Resize canvas — pick a template or enter a custom size"
                            className={darkUtilBtn}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2" />
                            </svg>
                            {canvasWidth} × {canvasHeight}
                            <svg
                                className={`w-3 h-3 text-[#6b6b80] transition-transform ${sizeMenuOpen ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {sizeMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#1e1e2a] border border-[#2a2a38] rounded-xl shadow-2xl shadow-black/60 p-3 z-50 select-none">
                                {/* Template presets */}
                                <p className="text-[10px] uppercase font-bold text-[#6b6b80] tracking-widest mb-2">
                                    Template Sizes
                                </p>
                                <div className="grid grid-cols-1 gap-0.5">
                                    {CANVAS_PRESETS.map((p) => {
                                        const active = p.width === canvasWidth && p.height === canvasHeight;
                                        return (
                                            <button
                                                key={p.label}
                                                onClick={() => {
                                                    handlePresetChange(`${p.width}x${p.height}`);
                                                    setSizeMenuOpen(false);
                                                }}
                                                disabled={loading}
                                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                                                    active
                                                        ? "border-violet-500/50 bg-violet-600/15 text-violet-300 font-semibold"
                                                        : "border-transparent text-[#c0c0d0] hover:bg-[#2a2a38]"
                                                }`}
                                            >
                                                <span className="flex items-center gap-2 min-w-0">
                                                    {active && (
                                                        <svg className="w-3.5 h-3.5 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    <span className={active ? "" : "pl-6"}>{p.label}</span>
                                                </span>
                                                <span className="text-[10px] text-[#6b6b80] tabular-nums shrink-0 ml-2">
                                                    {p.width}×{p.height}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Custom size */}
                                <div className="mt-3 pt-3 border-t border-[#2a2a38]">
                                    <p className="text-[10px] uppercase font-bold text-[#6b6b80] tracking-widest mb-2">
                                        Custom Size (px)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <label className="flex-1 flex items-center gap-1.5">
                                            <span className="w-4 shrink-0 text-[10px] font-bold text-[#6b6b80] uppercase">W</span>
                                            <input
                                                id="canvas-width"
                                                type="number"
                                                value={widthInput}
                                                onChange={(e) => handleWidthInput(e.target.value)}
                                                min={50}
                                                max={5000}
                                                disabled={loading}
                                                className="w-full px-2 py-1.5 text-xs border border-[#2a2a38] rounded-md bg-[#0d0d10] text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40"
                                            />
                                        </label>
                                        <span className="text-[#6b6b80] text-xs">×</span>
                                        <label className="flex-1 flex items-center gap-1.5">
                                            <span className="w-4 shrink-0 text-[10px] font-bold text-[#6b6b80] uppercase">H</span>
                                            <input
                                                id="canvas-height"
                                                type="number"
                                                value={heightInput}
                                                onChange={(e) => handleHeightInput(e.target.value)}
                                                min={50}
                                                max={5000}
                                                disabled={loading}
                                                className="w-full px-2 py-1.5 text-xs border border-[#2a2a38] rounded-md bg-[#0d0d10] text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40"
                                            />
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-[#4a4a60] mt-1.5">50 – 5000 px · resizes instantly</p>
                                </div>

                                {objects.length > 0 && (
                                    <p className="mt-3 pt-2.5 border-t border-[#2a2a38] flex items-center gap-1.5 text-[11px] text-amber-400">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                        </svg>
                                        Existing elements keep their size and won't auto-resize.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleUndo}
                        disabled={!canvas || history.length <= 1}
                        title="Undo last action (Ctrl+Z)"
                        className={darkUtilBtn}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a6 6 0 016 6v1M3 10l4-4m-4 4l4 4" />
                        </svg>
                        Undo
                    </button>

                    <button
                        onClick={handleRedo}
                        disabled={!canvas || redoStack.length === 0}
                        title="Redo last action (Ctrl+Y / Ctrl+Shift+Z)"
                        className={darkUtilBtn}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a6 6 0 00-6 6v1M21 10l-4-4m4 4l-4 4" />
                        </svg>
                        Redo
                    </button>

                    <button
                        onClick={handleGroup}
                        disabled={!canvas || !selectedObject || !("toGroup" in selectedObject)}
                        title="Group selected elements (Ctrl+G)"
                        className={darkUtilBtn}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                        </svg>
                        Group
                    </button>
                    <button
                        onClick={handleUngroup}
                        disabled={!canvas || !selectedObject || !("toActiveSelection" in selectedObject)}
                        title="Ungroup elements (Ctrl+Shift+G)"
                        className={darkUtilBtn}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 12h8M8 17h8" />
                        </svg>
                        Ungroup
                    </button>

                    {/* Alignment Tools — dropdown popover, visible saat ada objek dipilih */}
                    {selectedObject && (
                        <>
                            <div className="w-px h-5 bg-[#2a2a38] mx-0.5" />
                            <div ref={alignMenuRef} className="relative">
                                <button
                                    onClick={() => setAlignMenuOpen((o) => !o)}
                                    title="Align / Distribute elements"
                                    className={`${darkUtilBtn} ${alignMenuOpen ? "bg-[#2a2a3a] border-[#3a3a50]" : ""}`}
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h12M3 18h15"/>
                                        <line x1="3" y1="3" x2="3" y2="21" strokeWidth={2} strokeLinecap="round"/>
                                    </svg>
                                    Align
                                    <svg className={`w-2.5 h-2.5 text-[#6b6b80] transition-transform ${alignMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {alignMenuOpen && (
                                    <div className="absolute top-full mt-2 left-0 z-50 bg-[#18181f] border border-[#2a2a38] rounded-xl shadow-2xl shadow-black/60 p-3 w-[200px]">
                                        <p className="text-[10px] uppercase tracking-widest text-[#505068] font-semibold mb-2">Horizontal</p>
                                        <div className="flex gap-1 mb-3">
                                            {[
                                                { dir: "left" as const, title: "Kiri (canvas/group)", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h13"/><line x1="4" y1="3" x2="4" y2="21" strokeWidth={2} strokeLinecap="round"/></> },
                                                { dir: "center" as const, title: "Tengah (horizontal)", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M5 8h14M7 16h10"/> },
                                                { dir: "right" as const, title: "Kanan (canvas/group)", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 6H4M20 12H10M20 18H7"/><line x1="20" y1="3" x2="20" y2="21" strokeWidth={2} strokeLinecap="round"/></> },
                                            ].map(({ dir, title, icon }) => (
                                                <button key={dir} title={title} onClick={() => { handleAlign(dir); setAlignMenuOpen(false); }}
                                                    className="flex-1 flex items-center justify-center h-9 rounded-lg bg-[#222230] hover:bg-[#2a2a3a] border border-[#2a2a38] hover:border-[#3a3a50] transition-all">
                                                    <svg className="w-4 h-4 text-[#c0c0d0]" viewBox="0 0 24 24" fill="none" stroke="currentColor">{icon}</svg>
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] uppercase tracking-widest text-[#505068] font-semibold mb-2">Vertikal</p>
                                        <div className="flex gap-1">
                                            {[
                                                { dir: "top" as const, title: "Atas (canvas/group)", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h12M8 8v12M16 8v10"/><line x1="3" y1="4" x2="21" y2="4" strokeWidth={2} strokeLinecap="round"/></> },
                                                { dir: "middle" as const, title: "Tengah (vertikal)", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M8 5v14M16 7v10"/> },
                                                { dir: "bottom" as const, title: "Bawah (canvas/group)", icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 20h12M8 4v12M16 6v10"/><line x1="3" y1="20" x2="21" y2="20" strokeWidth={2} strokeLinecap="round"/></> },
                                            ].map(({ dir, title, icon }) => (
                                                <button key={dir} title={title} onClick={() => { handleAlign(dir); setAlignMenuOpen(false); }}
                                                    className="flex-1 flex items-center justify-center h-9 rounded-lg bg-[#222230] hover:bg-[#2a2a3a] border border-[#2a2a38] hover:border-[#3a3a50] transition-all">
                                                    <svg className="w-4 h-4 text-[#c0c0d0]" viewBox="0 0 24 24" fill="none" stroke="currentColor">{icon}</svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Divider */}
                    <div className="w-px h-5 bg-[#2a2a38] mx-0.5" />

                    <button
                        onClick={handleExportPNG}
                        disabled={!canvas || objects.length === 0}
                        className={darkUtilBtn}
                    >
                        PNG
                    </button>
                    <button
                        onClick={handleExportSVG}
                        disabled={!canvas || objects.length === 0}
                        className={darkUtilBtn}
                    >
                        SVG
                    </button>
                </div>
            </header>

            {/* ── Main 3-Column Body ────────────────────────────────────── */}
            <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
                {/* Left Sidebar - Layers */}
                <LeftSidebar
                    objects={objects}
                    selectedObject={selectedObject}
                    onSelectObject={handleSelectObject}
                    onDeleteObject={handleDeleteObject}
                    onToggleLock={handleToggleLock}
                    onReorderLayer={handleReorderLayer}
                    onUploadImage={handleUploadImage}
                    onRenameObject={handleRenameObject}
                />

                {/* Center Workspace */}
                <main className="flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden">
                    {/* Error sekarang tampil di AI panel — workspace tetap bersih */}

                    {/* Workspace viewport */}
                    <div
                        ref={workspaceRef}
                        className="flex-1 min-w-0 min-h-0 overflow-auto bg-[#0d0d10] relative"
                        style={{
                            backgroundImage:
                                "radial-gradient(circle at 1px 1px, #1e1e2a 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                        }}
                        onClick={(e) => {
                            const t = e.target as HTMLElement;
                            if (t.closest("[data-canvas-wrap]")) return;
                            if (t.closest("button, select, input, label, a")) return;
                            handleDeselect();
                        }}
                    >
                        {/* Project switching loading overlay */}
                        {projectLoading && (
                            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d10]/90 backdrop-blur-sm">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                                    <p className="text-sm font-medium text-[#9090a8]">Memuat proyek...</p>
                                </div>
                            </div>
                        )}
                        <div className="min-w-full min-h-full w-max h-max p-12 flex items-center justify-center">
                            <div className="flex flex-col items-center justify-center shrink-0">
                                <DesignCanvas
                                    svgString={svgData}
                                    onCanvasReady={handleCanvasReady}
                                    onSelectionChange={handleSelectionChange}
                                    onObjectsChange={handleObjectsChange}
                                    onHistorySnapshot={handleHistorySnapshot}
                                    suppressHistory={suppressHistory}
                                    width={canvasWidth}
                                    height={canvasHeight}
                                    zoom={zoom}
                                />
                                <p className="text-center text-[11px] text-[#4a4a60] mt-3">
                                    {canvasWidth} × {canvasHeight} px
                                    {zoom !== 1 ? ` · ${Math.round(zoom * 100)}%` : ""}
                                </p>
                                {objects.length > 0 && (
                                    <p className="text-center text-[10px] text-amber-500/70 mt-1">
                                        Elements keep their size/position — they won&apos;t auto-resize.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Floating zoom controls (pin to bottom right of viewport) */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-0.5 bg-[#1e1e2a]/90 backdrop-blur-md border border-[#2a2a38] rounded-xl shadow-2xl shadow-black/60 px-1 py-1 select-none z-30">
                        <button
                            onClick={() => setZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 100) / 100))}
                            title="Zoom out"
                            className="w-7 h-7 flex items-center justify-center text-[#9090a8] hover:text-[#e8e8f0] hover:bg-[#2a2a38] rounded-md text-base leading-none transition-colors"
                        >
                            −
                        </button>
                        <button
                            onClick={() => setZoom(1)}
                            title="Reset to 100%"
                            className="w-14 h-7 flex items-center justify-center text-xs font-semibold text-[#9090a8] hover:text-[#e8e8f0] hover:bg-[#2a2a38] rounded-md transition-colors"
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button
                            onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 100) / 100))}
                            title="Zoom in"
                            className="w-7 h-7 flex items-center justify-center text-[#9090a8] hover:text-[#e8e8f0] hover:bg-[#2a2a38] rounded-md text-base leading-none transition-colors"
                        >
                            +
                        </button>
                        <div className="w-px h-4 bg-[#2a2a38] mx-0.5" />
                        <button
                            onClick={() => fitCanvasTo(canvasWidth, canvasHeight)}
                            title="Fit canvas to viewport"
                            className="px-2 h-7 text-xs font-semibold text-[#9090a8] hover:text-[#e8e8f0] hover:bg-[#2a2a38] rounded-md transition-colors"
                        >
                            Fit
                        </button>
                    </div>
                </main>

                {/* Right Sidebar - AI Chat + Properties tabs */}
                <RightSidebar
                    selectedObject={selectedObject}
                    onChangeProperty={handlePropertyChange}
                    onToggleLock={handleToggleLock}
                    chatHistory={chatHistory}
                    inputText={chatInput}
                    onInputChange={setChatInput}
                    loading={loading}
                    onSendMessage={handleSendMessage}
                    generateError={error}
                    onClearChat={handleClearChat}
                    availableLayers={objects.map((o) => String((o as any).name || "").trim()).filter(Boolean)}
                />
            </div>

            {/* Project Sessions Drawer Modal */}
            <ProjectDrawer
                isOpen={projectDrawerOpen}
                onClose={() => setProjectDrawerOpen(false)}
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProject}
                onCreateNewProject={handleCreateProject}
                onRenameProject={handleRenameProject}
                onDeleteProject={handleDeleteProject}
            />
        </div>
    );
}
