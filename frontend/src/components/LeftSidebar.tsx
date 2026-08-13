"use client";

import { DragEvent, useRef, useState } from "react";
import type { FabricObject } from "fabric";

interface LeftSidebarProps {
    objects: FabricObject[];
    selectedObject: FabricObject | null;
    onSelectObject: (obj: FabricObject) => void;
    onDeleteObject: (obj: FabricObject) => void;
    onToggleLock: (obj: FabricObject) => void;
    onReorderLayer: (fromCanvasIndex: number, toCanvasIndex: number) => void;
    onUploadImage?: (dataUrl: string) => void;
    onRenameObject?: (obj: FabricObject, newName: string) => void;
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
}

function DragHandleIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" />
        </svg>
    );
}

function LockIcon({ locked }: { locked: boolean }) {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {locked ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12h4a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2h4m8-5v4H5m10-4a4 4 0 10-8 0" />
            )}
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-1.9-1.9L5 7m5 4v6m4-6v6m3-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-7 0h14" />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
    );
}

export default function LeftSidebar({
    objects,
    selectedObject,
    onSelectObject,
    onDeleteObject,
    onToggleLock,
    onReorderLayer,
    onUploadImage,
    onRenameObject,
    mobileOpen = false,
    onCloseMobile,
}: LeftSidebarProps) {
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<number | null>(null);
    const dragFromDisplayIndex = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inline layer rename state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editNameText, setEditNameText] = useState("");

    const getObjectTypeLabel = (obj: FabricObject) => {
        const type = obj.type || "Object";
        if (type.toLowerCase().includes("image")) return "Gambar";
        if (type.toLowerCase().includes("text")) return "Teks";
        if (type.toLowerCase().includes("path")) return "Vektor";
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const getObjectName = (obj: FabricObject) => {
        const customName = String((obj as any).name || "").trim();
        if (customName) return customName;

        if ("text" in obj && typeof (obj as { text?: unknown }).text === "string") {
            const txt = (obj as { text: string }).text;
            return txt.length > 15 ? txt.slice(0, 15) + "..." : txt;
        }
        return getObjectTypeLabel(obj);
    };

    const isLocked = (obj: FabricObject) => Boolean((obj as { lockMovementX?: boolean }).lockMovementX);

    // Display top layers first (reverse of canvas z-order: index 0 = bottom)
    const display = [...objects].reverse();

    const displayToCanvas = (displayIndex: number) => objects.length - 1 - displayIndex;

    const computeCanvasTarget = (displayIndex: number): number => {
        const fromDisplay = dragFromDisplayIndex.current ?? 0;
        let targetDisplay = displayIndex;
        if (targetDisplay > fromDisplay) {
            targetDisplay = targetDisplay + 1;
        }
        return Math.max(0, Math.min(objects.length - 1, displayToCanvas(targetDisplay)));
    };

    const handleDragStart = (e: DragEvent, displayIndex: number) => {
        dragFromDisplayIndex.current = displayIndex;
        setDraggingIndex(displayIndex);
        try {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(displayIndex));
        } catch {
            /* ignore */
        }
    };

    const handleDragOver = (e: DragEvent, displayIndex: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dropTarget !== displayIndex) setDropTarget(displayIndex);
    };

    const handleDrop = (e: DragEvent, displayIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const fromDisplay = dragFromDisplayIndex.current ?? 0;
        if (fromDisplay !== displayIndex) {
            onReorderLayer(displayToCanvas(fromDisplay), computeCanvasTarget(displayIndex));
        }
        setDraggingIndex(null);
        setDropTarget(null);
        dragFromDisplayIndex.current = null;
    };

    const handleDragEnd = () => {
        setDraggingIndex(null);
        setDropTarget(null);
        dragFromDisplayIndex.current = null;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUploadImage) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUrl = evt.target?.result as string;
            if (dataUrl) {
                onUploadImage(dataUrl);
            }
        };
        reader.readAsDataURL(file);
        // Reset file input value so same file can be uploaded twice if needed
        e.target.value = "";
    };

    const handleStartEdit = (e: React.MouseEvent, displayIndex: number, currentName: string) => {
        e.stopPropagation();
        setEditingIndex(displayIndex);
        setEditNameText(currentName);
    };

    const handleSaveEditName = (obj: FabricObject) => {
        if (onRenameObject && editNameText.trim()) {
            onRenameObject(obj, editNameText.trim());
        }
        setEditingIndex(null);
    };

    return (
        <aside className={`bg-[#1a1a22] border-r border-[#2a2a38] flex flex-col h-full select-none transition-all duration-300 ${
            mobileOpen
                ? "fixed inset-y-0 left-0 z-50 w-72 shadow-2xl"
                : "hidden lg:flex w-64 shrink-0"
        }`}>
            {/* Header & Quick Action */}
            <div className="p-3 border-b border-[#2a2a38] space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-[#9090a8] uppercase tracking-widest flex items-center gap-2">
                        <DragHandleIcon />
                        Layer & Elemen ({objects.length})
                    </h2>
                    {onCloseMobile && (
                        <button
                            onClick={onCloseMobile}
                            className="lg:hidden p-1 text-[#808098] hover:text-white rounded-md"
                            title="Tutup Panel"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Upload Image Action */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>+ Unggah Gambar</span>
                </button>
            </div>

            {/* Object List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {objects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#222230] flex items-center justify-center">
                            <svg className="w-5 h-5 text-[#3a3a50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-[#6b6b80]">Belum Ada Elemen</p>
                            <p className="text-[10px] text-[#3a3a50] mt-0.5">Minta AI buatkan desain atau unggah gambar untuk memulai</p>
                        </div>
                    </div>
                ) : (
                    display.map((obj, di) => {
                        const isSelected = selectedObject === obj;
                        const isDragging = draggingIndex === di;
                        const isDrop = dropTarget === di;
                        const locked = isLocked(obj);
                        const label = getObjectTypeLabel(obj);
                        const objectName = getObjectName(obj);
                        const isEditingName = editingIndex === di;

                        return (
                            <div
                                key={di}
                                draggable
                                onDragStart={(e) => handleDragStart(e, di)}
                                onDragOver={(e) => handleDragOver(e, di)}
                                onDrop={(e) => handleDrop(e, di)}
                                onDragEnd={handleDragEnd}
                                onClick={() => onSelectObject(obj)}
                                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-sm cursor-pointer transition-all duration-150 border ${
                                    isDragging
                                        ? "opacity-40 border-dashed border-violet-500"
                                        : isDrop
                                        ? "border-violet-500/60 bg-violet-900/20"
                                        : isSelected
                                        ? "bg-violet-600/15 text-violet-300 border border-violet-500/40"
                                        : "text-[#c0c0d0] hover:bg-[#222230] border-transparent hover:border-[#2a2a38]"
                                }`}
                            >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                                    <span className="text-[#3a3a50] group-hover:text-[#6b6b80] cursor-grab transition-colors shrink-0" title="Tarik untuk mengatur urutan">
                                        <DragHandleIcon />
                                    </span>
                                    <span
                                        className={`px-1.5 py-0.5 text-[9px] uppercase font-bold rounded-md shrink-0 ${
                                            label === "Gambar"
                                                ? "bg-blue-900/60 text-blue-300"
                                                : label === "Teks"
                                                ? "bg-violet-900/60 text-violet-300"
                                                : label === "Vektor"
                                                ? "bg-emerald-900/50 text-emerald-400"
                                                : "bg-amber-900/50 text-amber-400"
                                        }`}
                                    >
                                        {label}
                                    </span>

                                    {isEditingName ? (
                                        <input
                                            type="text"
                                            value={editNameText}
                                            onChange={(e) => setEditNameText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveEditName(obj);
                                                if (e.key === "Escape") setEditingIndex(null);
                                            }}
                                            onBlur={() => handleSaveEditName(obj)}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full px-1.5 py-0.5 text-xs bg-[#121218] border border-violet-500 rounded text-white focus:outline-none"
                                        />
                                    ) : (
                                        <span
                                            onDoubleClick={(e) => handleStartEdit(e, di, objectName)}
                                            className="truncate text-xs font-medium"
                                            title="Double click untuk ubah nama layer"
                                        >
                                            {objectName}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                    {!isEditingName && (
                                        <button
                                            onClick={(e) => handleStartEdit(e, di, objectName)}
                                            title="Ubah Nama Layer"
                                            className="opacity-0 group-hover:opacity-100 p-1 text-[#6b6b80] hover:text-violet-300 hover:bg-violet-900/20 rounded-md transition-all"
                                        >
                                            <PencilIcon />
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleLock(obj);
                                        }}
                                        title={locked ? "Buka Kunci Layer" : "Kunci Layer"}
                                        className={`p-1 rounded-md transition-colors ${
                                            locked
                                                ? "text-violet-400 bg-violet-900/30"
                                                : "opacity-0 group-hover:opacity-100 text-[#6b6b80] hover:text-violet-400 hover:bg-violet-900/20"
                                        }`}
                                    >
                                        <LockIcon locked={locked} />
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteObject(obj);
                                        }}
                                        title="Hapus Layer"
                                        className="opacity-0 group-hover:opacity-100 p-1 text-[#6b6b80] hover:text-red-400 hover:bg-red-900/20 rounded-md transition-all"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
}