"use client";

import { useState, useMemo } from "react";
import { ProjectSession } from "@/utils/projectStorage";

interface DashboardProps {
    projects: ProjectSession[];
    folders: string[];
    onSelectProject: (id: string) => void;
    onCreateProject: (name?: string, width?: number, height?: number) => void;
    onRenameProject: (id: string, newName: string) => void;
    onDeleteProject: (id: string) => void;
    onDuplicateProject: (id: string) => void;
    onToggleFavorite: (id: string) => void;
    onToggleTrash: (id: string) => void;
    onExportProjects?: () => void;
    onImportProjects?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCreateFolder: (folderName: string) => void;
    onDeleteFolder: (folderName: string) => void;
    onAssignFolder: (projectId: string, folderName?: string) => void;
}

interface PresetTemplate {
    title: string;
    description: string;
    width: number;
    height: number;
    bgGradient: string;
    borderColor: string;
    tag: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
    {
        title: "Poster & Flyer Promosi",
        description: "800 x 1200 px · Cetak & Digital UMKM",
        width: 800,
        height: 1200,
        bgGradient: "linear-gradient(135deg, #2d1829 0%, #1e121e 100%)",
        borderColor: "rgba(225, 29, 72, 0.2)",
        tag: "Vertikal",
    },
    {
        title: "Spanduk Toko Online",
        description: "1200 x 630 px · Header Web & E-Commerce",
        width: 1200,
        height: 630,
        bgGradient: "linear-gradient(135deg, #1b263b 0%, #0f172a 100%)",
        borderColor: "rgba(59, 130, 246, 0.2)",
        tag: "Horisontal",
    },
    {
        title: "Desain Promo Sosmed",
        description: "1080 x 1080 px · Feed Instagram & FB",
        width: 1080,
        height: 1080,
        bgGradient: "linear-gradient(135deg, #112a29 0%, #061919 100%)",
        borderColor: "rgba(20, 184, 166, 0.2)",
        tag: "Persegi",
    },
    {
        title: "Presentasi Profil Usaha",
        description: "1280 x 720 px · Proposal & Pitch Deck",
        width: 1280,
        height: 720,
        bgGradient: "linear-gradient(135deg, #241938 0%, #160f24 100%)",
        borderColor: "rgba(168, 85, 247, 0.2)",
        tag: "Layar Lebar",
    },
];

export default function Dashboard({
    projects,
    folders,
    onSelectProject,
    onCreateProject,
    onRenameProject,
    onDeleteProject,
    onDuplicateProject,
    onToggleFavorite,
    onToggleTrash,
    onExportProjects,
    onImportProjects,
    onCreateFolder,
    onDeleteFolder,
    onAssignFolder,
}: DashboardProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeNav, setActiveNav] = useState<"all" | "favorites" | "trash" | "folders">("all");
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    // Folder creation & assignment UI states
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [folderMenuProjectId, setFolderMenuProjectId] = useState<string | null>(null);

    // Filter projects based on activeNav tab & search query
    const filteredProjects = useMemo(() => {
        return projects.filter((p) => {
            // Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = p.name.toLowerCase().includes(q);
                if (!matchName) return false;
            }

            // Nav Tabs
            if (activeNav === "favorites") return p.isFavorite && !p.isTrash;
            if (activeNav === "trash") return p.isTrash;
            if (activeNav === "folders" && selectedFolder) {
                return p.folder === selectedFolder && !p.isTrash;
            }

            // Default 'all'
            return !p.isTrash;
        });
    }, [projects, searchQuery, activeNav, selectedFolder]);

    const handleStartRename = (p: ProjectSession) => {
        setEditingProjectId(p.id);
        setEditingName(p.name);
    };

    const handleSaveRename = (id: string) => {
        if (editingName.trim()) {
            onRenameProject(id, editingName.trim());
        }
        setEditingProjectId(null);
    };

    const getTimeAgo = (dateStr: string) => {
        try {
            const diff = Date.now() - new Date(dateStr).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return "Baru saja";
            if (mins < 60) return `Diedit ${mins} mnt lalu`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `Diedit ${hours} jam lalu`;
            const days = Math.floor(hours / 24);
            if (days === 1) return "Diedit Kemarin";
            return `Diedit ${days} hari lalu`;
        } catch {
            return "Baru saja diedit";
        }
    };

    // Extract SVG thumbnail from project (prioritize cached thumbnailSvg, fallback to chatHistory)
    const getThumbnailSvg = (project: ProjectSession): string | null => {
        // 1. Prioritize cached thumbnailSvg field
        if (project.thumbnailSvg) return project.thumbnailSvg;
        // 2. Fallback to latest SVG from chatHistory
        if (!project.chatHistory || project.chatHistory.length === 0) return null;
        for (let i = project.chatHistory.length - 1; i >= 0; i--) {
            const msg = project.chatHistory[i];
            if (msg.role === "assistant" && msg.content.trimStart().startsWith("<svg")) {
                return msg.content;
            }
        }
        return null;
    };

    return (
        <div className="flex flex-col h-screen bg-[#0b0b10] text-[#e8e8f0] font-sans overflow-hidden select-none">
            {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
            <header className="h-14 border-b border-[#1a1a24] bg-[#0d0d14] flex items-center justify-between px-6 shrink-0 z-10">
                {/* Brand Logo & Title */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-purple-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                            VEKTRA
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                AI Canvas
                            </span>
                        </h1>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex-1 max-w-md mx-8">
                    <div className="relative">
                        <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a4a62]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari desain dan template usaha..."
                            className="w-full pl-10 pr-4 py-1.5 text-xs bg-[#161622] border border-[#262636] rounded-xl text-[#e8e8f0] placeholder-[#4a4a62] focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6b6b80] hover:text-white"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Profile & Create Action */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onCreateProject()}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-md shadow-violet-600/30 flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Proyek Baru
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 p-0.5 shadow-md">
                        <div className="w-full h-full rounded-full bg-[#12121c] flex items-center justify-center text-xs font-bold text-violet-300">
                            VK
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main Dashboard Body (Sidebar + Content) ─────────────────────────── */}
            <div className="flex-1 flex min-h-0">
                {/* Left Sidebar Navigation */}
                <aside className="w-60 bg-[#0d0d14] border-r border-[#1a1a24] flex flex-col p-4 shrink-0 overflow-y-auto gap-6">
                    <nav className="space-y-1">
                        <button
                            onClick={() => { setActiveNav("all"); setSelectedFolder(null); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                activeNav === "all"
                                    ? "bg-[#201d33] text-violet-300 border border-violet-500/30"
                                    : "text-[#808098] hover:text-[#e8e8f0] hover:bg-[#151520]"
                            }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                Semua Desain
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161622] text-[#6b6b80]">
                                {projects.filter((p) => !p.isTrash).length}
                            </span>
                        </button>

                        <button
                            onClick={() => { setActiveNav("favorites"); setSelectedFolder(null); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                activeNav === "favorites"
                                    ? "bg-[#201d33] text-violet-300 border border-violet-500/30"
                                    : "text-[#808098] hover:text-[#e8e8f0] hover:bg-[#151520]"
                            }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                Desain Favorit
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161622] text-[#6b6b80]">
                                {projects.filter((p) => p.isFavorite && !p.isTrash).length}
                            </span>
                        </button>

                        <button
                            onClick={() => { setActiveNav("trash"); setSelectedFolder(null); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                activeNav === "trash"
                                    ? "bg-[#201d33] text-violet-300 border border-violet-500/30"
                                    : "text-[#808098] hover:text-[#e8e8f0] hover:bg-[#151520]"
                            }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Tong Sampah
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161622] text-[#6b6b80]">
                                {projects.filter((p) => p.isTrash).length}
                            </span>
                        </button>
                    </nav>

                    <div className="border-t border-[#1a1a24] pt-4">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#505068]">
                                Folder Kategori
                            </h3>
                            <button
                                onClick={() => setIsCreatingFolder((o) => !o)}
                                title="Buat Folder Baru"
                                className="p-1 rounded text-violet-400 hover:bg-violet-950/40 transition-colors text-xs font-semibold flex items-center gap-1"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="text-[10px]">Folder</span>
                            </button>
                        </div>

                        {/* Form Inline Buat Folder */}
                        {isCreatingFolder && (
                            <div className="px-3 mb-2.5 space-y-1.5">
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="Nama Folder Baru..."
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            if (newFolderName.trim()) {
                                                onCreateFolder(newFolderName.trim());
                                                setNewFolderName("");
                                                setIsCreatingFolder(false);
                                            }
                                        }
                                        if (e.key === "Escape") setIsCreatingFolder(false);
                                    }}
                                    autoFocus
                                    className="w-full px-2.5 py-1.5 text-xs bg-[#161622] border border-violet-500 rounded-lg text-white placeholder-[#505068] focus:outline-none"
                                />
                                <div className="flex items-center justify-end gap-1.5">
                                    <button
                                        onClick={() => setIsCreatingFolder(false)}
                                        className="px-2 py-0.5 text-[10px] text-[#808098] hover:text-white"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (newFolderName.trim()) {
                                                onCreateFolder(newFolderName.trim());
                                                setNewFolderName("");
                                                setIsCreatingFolder(false);
                                            }
                                        }}
                                        className="px-2.5 py-0.5 text-[10px] bg-violet-600 hover:bg-violet-500 text-white rounded font-medium"
                                    >
                                        Tambah
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            {folders.length === 0 ? (
                                <p className="px-3 py-2 text-[11px] text-[#505068] italic">Belum ada folder</p>
                            ) : (
                                folders.map((folder) => {
                                    const isSel = activeNav === "folders" && selectedFolder === folder;
                                    const count = projects.filter((p) => p.folder === folder && !p.isTrash).length;
                                    return (
                                        <div key={folder} className="group relative flex items-center">
                                            <button
                                                onClick={() => {
                                                    setActiveNav("folders");
                                                    setSelectedFolder(folder);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                                                    isSel
                                                        ? "bg-[#201d33] text-violet-300 border border-violet-500/30 font-semibold"
                                                        : "text-[#808098] hover:text-[#e8e8f0] hover:bg-[#151520]"
                                                }`}
                                            >
                                                <span className="flex items-center gap-2.5 truncate max-w-[130px]">
                                                    <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                    </svg>
                                                    <span className="truncate">{folder}</span>
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161622] text-[#6b6b80]">
                                                    {count}
                                                </span>
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteFolder(folder);
                                                    if (selectedFolder === folder) {
                                                        setActiveNav("all");
                                                        setSelectedFolder(null);
                                                    }
                                                }}
                                                title={`Hapus folder ${folder}`}
                                                className="absolute right-8 opacity-0 group-hover:opacity-100 p-1 text-[#6b6b80] hover:text-red-400 transition-opacity"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Data Backup Section ─────────────────────── */}
                    <div className="mt-auto pt-4 border-t border-[#1a1a24] space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest text-[#505068] font-semibold px-1 mb-2">Backup Data</p>
                        <button
                            onClick={onExportProjects}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#808098] hover:text-[#e8e8f0] hover:bg-[#151520] transition-all"
                        >
                            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Export Proyek (JSON)
                        </button>
                        <label className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[#808098] hover:text-[#e8e8f0] hover:bg-[#151520] transition-all cursor-pointer">
                            <svg className="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import Proyek (JSON)
                            <input type="file" accept=".json" className="hidden" onChange={onImportProjects} />
                        </label>
                    </div>
                </aside>

                {/* Right Scrollable Dashboard Canvas */}
                <main className="flex-1 overflow-y-auto p-8 space-y-10 min-h-0">
                    {/* ── 1. Hero Banner ────────────────────────────────────────────── */}
                    <div className="relative rounded-3xl overflow-hidden p-8 border border-violet-500/20 shadow-2xl bg-gradient-to-r from-[#201235] via-[#141228] to-[#0d0d18]">
                        {/* Glow Circles background */}
                        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 right-10 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

                        <div className="relative z-10 max-w-xl space-y-4">
                            <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
                                Wujudkan Ide. Buat Desain. Kembangkan Usaha.
                            </h2>
                            <p className="text-sm text-[#9090a8] leading-relaxed">
                                Padukan kontrol vektor dengan AI canggih untuk membuat poster, spanduk, dan materi promosi UMKM dalam hitungan detik.
                            </p>
                            <div className="pt-2">
                                <button
                                    onClick={() => onCreateProject()}
                                    className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-xl shadow-violet-600/40 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Buat Desain dengan Asisten AI
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── 2. Quick Start Templates ───────────────────────────────────── */}
                    <section className="space-y-4">
                        <h3 className="text-base font-bold tracking-tight text-white">
                            Template Siap Pakai UMKM
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {PRESET_TEMPLATES.map((tmpl) => (
                                <div
                                    key={tmpl.title}
                                    onClick={() => onCreateProject(tmpl.title, tmpl.width, tmpl.height)}
                                    className="group relative rounded-2xl p-5 border cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 flex flex-col justify-between h-40"
                                    style={{
                                        background: tmpl.bgGradient,
                                        borderColor: tmpl.borderColor,
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                                            {tmpl.tag}
                                        </span>
                                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                                            {tmpl.title}
                                        </h4>
                                        <p className="text-xs text-[#9090a8] mt-0.5">
                                            {tmpl.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── 3. Recent Projects Grid ────────────────────────────────────── */}
                    <section className="space-y-4 pb-12">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                                Desain Terbaru
                                <span className="text-xs font-normal text-[#6b6b80]">
                                    ({filteredProjects.length})
                                </span>
                            </h3>
                        </div>

                        {filteredProjects.length === 0 ? (
                            <div className="p-12 border border-dashed border-[#262636] rounded-3xl flex flex-col items-center justify-center text-center space-y-3 bg-[#11111a]/40">
                                <div className="w-12 h-12 rounded-2xl bg-[#1c1c28] flex items-center justify-center text-[#505068]">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <p className="text-sm font-semibold text-[#808098]">Belum ada desain ditemukan</p>
                                <button
                                    onClick={() => onCreateProject()}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
                                >
                                    + Buat Desain Baru
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                {filteredProjects.map((p) => {
                                    const svgThumb = getThumbnailSvg(p);
                                    const isEditing = editingProjectId === p.id;

                                    return (
                                        <div
                                            key={p.id}
                                            className="group bg-[#13131c] border border-[#222232] hover:border-violet-500/40 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 shadow-lg shadow-black/40"
                                        >
                                            {/* Preview Thumbnail Box */}
                                            <div
                                                onClick={() => onSelectProject(p.id)}
                                                className="h-44 bg-[#0d0d14] border-b border-[#222232] relative overflow-hidden flex items-center justify-center cursor-pointer group-hover:bg-[#101018] transition-colors p-2"
                                            >
                                                {svgThumb ? (
                                                    <div
                                                        className="w-full h-full flex items-center justify-center overflow-hidden rounded"
                                                        dangerouslySetInnerHTML={{
                                                            __html: svgThumb.replace(
                                                                /<svg/,
                                                                '<svg style="width:100%;height:100%;object-fit:contain"'
                                                            ),
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center gap-2 text-[#404058]">
                                                        <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        <span className="text-[10px] font-mono tracking-wider">Kanvas Kosong</span>
                                                    </div>
                                                )}

                                                {/* Favorite Star Badge */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleFavorite(p.id);
                                                    }}
                                                    title={p.isFavorite ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                                                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:scale-110 transition-transform"
                                                >
                                                    <svg
                                                        className={`w-3.5 h-3.5 ${p.isFavorite ? "text-amber-400 fill-amber-400" : "text-[#808098]"}`}
                                                        fill={p.isFavorite ? "currentColor" : "none"}
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                    </svg>
                                                </button>
                                            </div>

                                                {/* Card Footer Info */}
                                                <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
                                                    <div>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                value={editingName}
                                                                onChange={(e) => setEditingName(e.target.value)}
                                                                onBlur={() => handleSaveRename(p.id)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") handleSaveRename(p.id);
                                                                }}
                                                                autoFocus
                                                                className="w-full px-2 py-1 text-xs bg-[#1a1a28] border border-violet-500 rounded text-white focus:outline-none"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-between gap-2">
                                                                <h4
                                                                    onClick={() => onSelectProject(p.id)}
                                                                    className="text-xs font-semibold text-[#e8e8f0] group-hover:text-violet-300 transition-colors truncate cursor-pointer flex-1"
                                                                    title={p.name}
                                                                >
                                                                    {p.name}
                                                                </h4>
                                                                {p.folder && (
                                                                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-violet-950/60 text-violet-300 border border-violet-500/30 shrink-0 truncate max-w-[90px]" title={`Folder: ${p.folder}`}>
                                                                        📁 {p.folder}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between text-[10px] text-[#6b6b82]">
                                                        <span>{getTimeAgo(p.updatedAt)}</span>
                                                        <span className="font-mono bg-[#1a1a24] px-1.5 py-0.5 rounded text-[#808098]">
                                                            {p.canvasWidth} × {p.canvasHeight}
                                                        </span>
                                                    </div>

                                                    {/* Action Bar */}
                                                    <div className="pt-2 border-t border-[#1c1c28] flex items-center justify-end gap-1 relative">
                                                        {/* Move to Folder Button & Popover */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFolderMenuProjectId((cur) => (cur === p.id ? null : p.id));
                                                                }}
                                                                title="Pindahkan ke Folder"
                                                                className={`p-1 rounded transition-colors ${
                                                                    folderMenuProjectId === p.id
                                                                        ? "bg-violet-900/40 text-violet-300"
                                                                        : "hover:bg-[#202030] text-[#707088] hover:text-white"
                                                                }`}
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                                </svg>
                                                            </button>

                                                            {folderMenuProjectId === p.id && (
                                                                <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-[#181824] border border-[#2a2a38] rounded-xl shadow-2xl p-1.5 z-30 select-none space-y-0.5">
                                                                    <p className="px-2 py-1 text-[9px] uppercase font-bold text-[#6b6b80] border-b border-[#2a2a38] mb-1">
                                                                        Pindahkan Ke Folder:
                                                                    </p>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onAssignFolder(p.id, undefined);
                                                                            setFolderMenuProjectId(null);
                                                                        }}
                                                                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                                                                            !p.folder ? "text-violet-400 font-semibold bg-violet-900/20" : "text-[#707088] hover:bg-[#222230] hover:text-white"
                                                                        }`}
                                                                    >
                                                                        <span>Tanpa Folder</span>
                                                                        {!p.folder && <span>✓</span>}
                                                                    </button>
                                                                    {folders.map((f) => {
                                                                        const isCurrent = p.folder === f;
                                                                        return (
                                                                            <button
                                                                                key={f}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onAssignFolder(p.id, f);
                                                                                    setFolderMenuProjectId(null);
                                                                                }}
                                                                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                                                                                    isCurrent ? "text-violet-400 font-semibold bg-violet-900/20" : "text-[#808098] hover:bg-[#222230] hover:text-white"
                                                                                }`}
                                                                            >
                                                                                <span className="truncate">📁 {f}</span>
                                                                                {isCurrent && <span className="shrink-0 ml-1">✓</span>}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={() => handleStartRename(p)}
                                                            title="Ganti Nama"
                                                            className="p-1 rounded hover:bg-[#202030] text-[#707088] hover:text-white transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => onDuplicateProject(p.id)}
                                                            title="Duplikat Proyek"
                                                            className="p-1 rounded hover:bg-[#202030] text-[#707088] hover:text-white transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => p.isTrash ? onDeleteProject(p.id) : onToggleTrash(p.id)}
                                                            title={p.isTrash ? "Hapus Permanen" : "Pindahkan ke Sampah"}
                                                            className="p-1 rounded hover:bg-red-950/40 text-[#707088] hover:text-red-400 transition-colors"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
