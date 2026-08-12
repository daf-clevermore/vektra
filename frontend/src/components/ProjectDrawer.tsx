"use client";

import { useState } from "react";
import { ProjectSession } from "@/utils/projectStorage";

interface ProjectDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    projects: ProjectSession[];
    activeProjectId: string | null;
    onSelectProject: (projectId: string) => void;
    onCreateNewProject: () => void;
    onRenameProject: (projectId: string, newName: string) => void;
    onDeleteProject: (projectId: string) => void;
}

export default function ProjectDrawer({
    isOpen,
    onClose,
    projects,
    activeProjectId,
    onSelectProject,
    onCreateNewProject,
    onRenameProject,
    onDeleteProject,
}: ProjectDrawerProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    if (!isOpen) return null;

    const handleStartEdit = (p: ProjectSession) => {
        setEditingId(p.id);
        setEditName(p.name);
    };

    const handleSaveEdit = (projectId: string) => {
        if (editName.trim()) {
            onRenameProject(projectId, editName.trim());
        }
        setEditingId(null);
    };

    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-[#181822] border border-[#2a2a38] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                {/* Header Modal */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a38] bg-[#1d1d2b]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#e8e8f0]">Sesi Project & Riwayat Desain</h2>
                            <p className="text-xs text-[#787890]">Kelola dan lanjutkan sesi pembuatan desain vektor VEKTRA</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#787890] hover:text-[#e8e8f0] hover:bg-[#2a2a38] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body & Project List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#787890]">
                            Daftar Project ({projects.length})
                        </span>
                        <button
                            onClick={onCreateNewProject}
                            className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-lg shadow-violet-600/25"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            + Project Baru
                        </button>
                    </div>

                    {projects.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-[#2a2a38] rounded-xl bg-[#14141d]">
                            <p className="text-sm text-[#787890]">Belum ada sesi project tersimpan.</p>
                            <button
                                onClick={onCreateNewProject}
                                className="mt-3 text-xs text-violet-400 hover:underline font-medium"
                            >
                                Buat project pertama Anda sekarang →
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                            {projects.map((p) => {
                                const isActive = p.id === activeProjectId;
                                return (
                                    <div
                                        key={p.id}
                                        className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${
                                            isActive
                                                ? "bg-violet-950/20 border-violet-500/50 shadow-md shadow-violet-950/30"
                                                : "bg-[#1d1d2b]/60 border-[#2a2a38] hover:border-[#3d3d52] hover:bg-[#1d1d2b]"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isActive
                                                        ? "bg-violet-600 text-white"
                                                        : "bg-[#282838] text-[#9090a8] group-hover:text-violet-300"
                                                }`}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                {editingId === p.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(p.id)}
                                                            autoFocus
                                                            className="px-2.5 py-1 text-xs bg-[#14141d] border border-violet-500 rounded-md text-[#e8e8f0] focus:outline-none"
                                                        />
                                                        <button
                                                            onClick={() => handleSaveEdit(p.id)}
                                                            className="text-xs text-emerald-400 hover:underline font-semibold"
                                                        >
                                                            Simpan
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-xs font-bold text-[#e8e8f0] truncate">
                                                            {p.name}
                                                        </h3>
                                                        {isActive && (
                                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-violet-600/30 text-violet-300 rounded-full border border-violet-500/40">
                                                                Aktif
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="text-[11px] text-[#787890] mt-0.5 flex items-center gap-2">
                                                    <span>{p.canvasWidth} × {p.canvasHeight} px</span>
                                                    <span>•</span>
                                                    <span>{p.chatHistory?.length ? Math.floor(p.chatHistory.length / 2) : 0} dialog turn</span>
                                                    <span>•</span>
                                                    <span>Update: {formatDate(p.updatedAt)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                            {!isActive && (
                                                <button
                                                    onClick={() => onSelectProject(p.id)}
                                                    className="px-3 py-1.5 text-xs font-medium text-violet-300 bg-violet-950/40 hover:bg-violet-900/60 border border-violet-500/30 rounded-lg transition-colors"
                                                >
                                                    Buka Project
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleStartEdit(p)}
                                                title="Ubah Nama Project"
                                                className="p-1.5 text-[#787890] hover:text-[#e8e8f0] hover:bg-[#282838] rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>

                                            <button
                                                onClick={() => onDeleteProject(p.id)}
                                                title="Hapus Project"
                                                className="p-1.5 text-[#787890] hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-1.9-1.9L5 7m5 4v6m4-6v6m3-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-7 0h14" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3 border-t border-[#2a2a38] bg-[#1d1d2b] flex items-center justify-between text-xs text-[#787890]">
                    <span>Sesi project disimpan secara lokal di browser (*localStorage*).</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 font-medium text-[#e8e8f0] bg-[#2a2a38] hover:bg-[#343446] rounded-lg transition-colors"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
