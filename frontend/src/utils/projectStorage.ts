"use client";

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ProjectSession {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    canvasWidth: number;
    canvasHeight: number;
    canvasJson: any;
    chatHistory: ChatMessage[];
    isFavorite?: boolean;
    isTrash?: boolean;
    folder?: string;
    thumbnailSvg?: string;
}

const PROJECTS_STORAGE_KEY = "vektra_project_sessions";
const ACTIVE_PROJECT_ID_KEY = "vektra_active_project_id";
const FOLDERS_STORAGE_KEY = "vektra_custom_folders";
const DEFAULT_FOLDERS = ["Aset Pemasaran", "Desain Produk"];

export function getAllFolders(): string[] {
    if (typeof window === "undefined") return DEFAULT_FOLDERS;
    try {
        const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
        if (!raw) {
            localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(DEFAULT_FOLDERS));
            return DEFAULT_FOLDERS;
        }
        return JSON.parse(raw);
    } catch {
        return DEFAULT_FOLDERS;
    }
}

export function createFolder(folderName: string): string[] {
    if (typeof window === "undefined") return [];
    const trimmed = folderName.trim();
    if (!trimmed) return getAllFolders();
    try {
        const folders = getAllFolders();
        if (!folders.includes(trimmed)) {
            folders.push(trimmed);
            localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
        }
        return folders;
    } catch {
        return getAllFolders();
    }
}

export function deleteFolder(folderName: string): { folders: string[]; projects: ProjectSession[] } {
    if (typeof window === "undefined") return { folders: [], projects: [] };
    try {
        const folders = getAllFolders().filter((f) => f !== folderName);
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));

        const projects = getAllProjects().map((p) => {
            if (p.folder === folderName) {
                const { folder, ...rest } = p;
                return rest;
            }
            return p;
        });
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        return { folders, projects };
    } catch {
        return { folders: getAllFolders(), projects: getAllProjects() };
    }
}

export function assignProjectToFolder(projectId: string, folderName?: string): ProjectSession[] {
    if (typeof window === "undefined") return [];
    try {
        const projects = getAllProjects().map((p) => {
            if (p.id === projectId) {
                return {
                    ...p,
                    folder: folderName && folderName.trim() ? folderName.trim() : undefined,
                    updatedAt: new Date().toISOString(),
                };
            }
            return p;
        });
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        return projects;
    } catch {
        return getAllProjects();
    }
}

export function getAllProjects(): ProjectSession[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function saveProject(project: ProjectSession): void {
    if (typeof window === "undefined") return;
    try {
        const projects = getAllProjects();
        const existingIndex = projects.findIndex((p) => p.id === project.id);
        const updatedProject = {
            ...project,
            updatedAt: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
            projects[existingIndex] = updatedProject;
        } else {
            projects.unshift(updatedProject);
        }

        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        localStorage.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
    } catch (e) {
        console.error("Gagal menyimpan project ke localStorage:", e);
    }
}

export function deleteProject(projectId: string): ProjectSession[] {
    if (typeof window === "undefined") return [];
    try {
        const projects = getAllProjects().filter((p) => p.id !== projectId);
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        const activeId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
        if (activeId === projectId) {
            localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
        }
        return projects;
    } catch {
        return [];
    }
}

export function duplicateProject(projectId: string): ProjectSession | null {
    if (typeof window === "undefined") return null;
    try {
        const projects = getAllProjects();
        const target = projects.find((p) => p.id === projectId);
        if (!target) return null;

        const newId = `proj_${Date.now()}`;
        const newProj: ProjectSession = {
            ...target,
            id: newId,
            name: `${target.name} (Salinan)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        projects.unshift(newProj);
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        return newProj;
    } catch {
        return null;
    }
}

export function toggleFavoriteProject(projectId: string): ProjectSession[] {
    if (typeof window === "undefined") return [];
    try {
        const projects = getAllProjects().map((p) => {
            if (p.id === projectId) {
                return { ...p, isFavorite: !p.isFavorite };
            }
            return p;
        });
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        return projects;
    } catch {
        return [];
    }
}

export function toggleTrashProject(projectId: string): ProjectSession[] {
    if (typeof window === "undefined") return [];
    try {
        const projects = getAllProjects().map((p) => {
            if (p.id === projectId) {
                return { ...p, isTrash: !p.isTrash };
            }
            return p;
        });
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        return projects;
    } catch {
        return [];
    }
}

export function getActiveProjectId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
}

export function setActiveProjectId(id: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACTIVE_PROJECT_ID_KEY, id);
}

export function createNewProject(
    name?: string,
    width = 800,
    height = 600,
    folder?: string
): ProjectSession {
    const timestamp = Date.now();
    const newProject: ProjectSession = {
        id: `proj_${timestamp}`,
        name: name || `Project ${new Date().toLocaleDateString("id-ID")}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canvasWidth: width,
        canvasHeight: height,
        canvasJson: null,
        chatHistory: [],
        folder,
    };
    saveProject(newProject);
    return newProject;
}
