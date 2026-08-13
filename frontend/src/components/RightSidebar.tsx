"use client";

import { useState, useEffect, useRef } from "react";
import { FabricObject } from "fabric";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
    role: "user" | "assistant";
    /** For user: the prompt text. For assistant: the raw SVG string. */
    content: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RightSidebarProps {
    // Properties tab
    selectedObject: FabricObject | null;
    onChangeProperty: (property: string, value: unknown) => void;
    onToggleLock: (obj: FabricObject) => void;
    // AI Generate tab — now chat-based
    chatHistory: ChatMessage[];
    inputText: string;
    onInputChange: (v: string) => void;
    loading: boolean;
    onSendMessage: () => void;
    generateError: string | null;
    onClearChat: () => void;
    availableLayers?: string[];
    mobileOpen?: boolean;
    onCloseMobile?: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface NumberFieldProps {
    label: string;
    value: number;
    onChange: (value: string) => void;
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase font-semibold tracking-widest text-[#9090a8]">
                {label}
            </span>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full mt-1 px-2.5 py-1.5 text-xs border border-[#2a2a38] rounded-md bg-[#0d0d10] text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
            />
        </label>
    );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg, index }: { msg: ChatMessage; index: number }) {
    const isUser = msg.role === "user";

    if (isUser) {
        return (
            <div className="flex justify-end gap-2 group" key={index}>
                <div className="max-w-[85%] flex flex-col items-end gap-1">
                    <div
                        className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
                        style={{
                            background:
                                "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        }}
                    >
                        {msg.content}
                    </div>
                    <span className="text-[10px] text-[#3a3a50]">Anda</span>
                </div>
            </div>
        );
    }

    // Assistant bubble — show summary, not raw SVG
    const isSvg = msg.content.trimStart().startsWith("<svg");
    return (
        <div className="flex justify-start gap-2 group" key={index}>
            <div className="flex flex-col gap-1 max-w-[85%]">
                {/* Avatar */}
                <div className="flex items-end gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shrink-0 mb-1">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[#222230] border border-[#2a2a38] text-sm leading-relaxed text-[#e8e8f0]">
                        {isSvg ? (
                            <div className="flex items-center gap-2">
                                {/* Mini SVG preview thumbnail */}
                                <div
                                    className="w-10 h-8 rounded-md overflow-hidden border border-[#2a2a38] bg-white shrink-0"
                                    dangerouslySetInnerHTML={{
                                        __html: msg.content.replace(
                                            /<svg/,
                                            '<svg style="width:100%;height:100%;object-fit:contain"'
                                        ),
                                    }}
                                />
                                <div>
                                    <p className="text-xs font-semibold text-[#e8e8f0]">Desain Diperbarui ✓</p>
                                    <p className="text-[10px] text-[#6b6b80]">Kanvas telah diperbarui dengan desain baru</p>
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-[#9090a8] italic">{msg.content}</span>
                        )}
                    </div>
                </div>
                <span className="text-[10px] text-[#3a3a50] pl-8">Asisten AI</span>
            </div>
        </div>
    );
}

// ─── Tab: AI Chat ─────────────────────────────────────────────────────────────
interface AIChatTabProps {
    chatHistory: ChatMessage[];
    inputText: string;
    onInputChange: (v: string) => void;
    loading: boolean;
    onSendMessage: () => void;
    generateError: string | null;
    onClearChat: () => void;
    availableLayers?: string[];
}

function AIChatTab({
    chatHistory,
    inputText,
    onInputChange,
    loading,
    onSendMessage,
    generateError,
    onClearChat,
    availableLayers = [],
}: AIChatTabProps) {
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const canSend = !loading && inputText.trim().length > 0;
    const hasHistory = chatHistory.length > 0;

    const [mentionQuery, setMentionQuery] = useState<string | null>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, loading]);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [inputText]);

    const handleTextChange = (val: string) => {
        onInputChange(val);
        const match = val.match(/@([a-zA-Z0-9_\-]*)$/);
        if (match) {
            setMentionQuery(match[1].toLowerCase());
        } else {
            setMentionQuery(null);
        }
    };

    const handleSelectMention = (layerName: string) => {
        const newText = inputText.replace(/@([a-zA-Z0-9_\-]*)$/, `@${layerName} `);
        onInputChange(newText);
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* ── Chat Header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a38] shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-[#9090a8]">
                        {hasHistory
                            ? `${Math.floor(chatHistory.length / 2)} percakapan`
                            : "Percakapan Baru"}
                    </span>
                </div>
                {hasHistory && (
                    <button
                        onClick={onClearChat}
                        title="Bersihkan Obrolan"
                        className="p-1 rounded-md text-[#4a4a60] hover:text-red-400 hover:bg-red-900/20 transition-all"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>

            {/* ── Messages Area ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0">
                {!hasHistory ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
                            <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#6b6b80]">Mulai Percakapan Baru</p>
                            <p className="text-xs text-[#3a3a50] mt-1 leading-relaxed max-w-[180px]">
                                Jelaskan kebutuhan desain UMKM Anda dan Asisten AI akan membuatnya. Ketik @ untuk menyebut nama layer!
                            </p>
                        </div>
                        {/* Quick start suggestions */}
                        <div className="w-full space-y-1.5">
                            {[
                                "Logo kedai kopi kekinian, warna cokelat & emas",
                                "Banner promosi diskon produk makanan kuliner",
                                "Spanduk promo buka toko online diskon 50%",
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => onInputChange(suggestion)}
                                    className="w-full text-left px-3 py-2 rounded-xl bg-[#1a1a24] border border-[#2a2a38] text-xs text-[#6b6b80] hover:text-[#c0c0d0] hover:border-violet-500/30 hover:bg-[#1e1e2e] transition-all"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {chatHistory.map((msg, i) => (
                            <ChatBubble key={i} msg={msg} index={i} />
                        ))}

                        {/* Loading bubble */}
                        {loading && (
                            <div className="flex justify-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shrink-0 mt-1">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#222230] border border-[#2a2a38] flex items-center gap-2">
                                    <span className="flex gap-1">
                                        {[0, 1, 2].map((i) => (
                                            <span
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full bg-violet-400"
                                                style={{
                                                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                                }}
                                            />
                                        ))}
                                    </span>
                                    <span className="text-xs text-[#6b6b80]">Sedang merancang desain untuk Anda…</span>
                                </div>
                            </div>
                        )}

                        {/* Error bubble */}
                        {generateError && (
                            <div className="flex justify-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-900/50 border border-red-800/50 flex items-center justify-center shrink-0 mt-1">
                                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01" />
                                    </svg>
                                </div>
                                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-red-950/50 border border-red-800/50 text-xs text-red-400 leading-relaxed max-w-[85%]">
                                    {generateError}
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* ── Input Area ────────────────────────────────────────────── */}
            <div className="shrink-0 p-3 border-t border-[#2a2a38] relative">
                {/* Floating Mention Autocomplete Popup */}
                {mentionQuery !== null && availableLayers.length > 0 && (
                    <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 bg-[#181822] border border-violet-500/40 rounded-xl shadow-2xl max-h-40 overflow-y-auto space-y-0.5 z-50 animate-in fade-in duration-150">
                        <div className="px-2 py-1 text-[10px] uppercase font-bold text-violet-400 border-b border-[#2a2a38] flex items-center justify-between">
                            <span>Mention Layer Objek (@)</span>
                            <span className="text-[9px] text-[#6b6b80]">Gunakan di prompt</span>
                        </div>
                        {availableLayers
                            .filter((l) => l.toLowerCase().includes(mentionQuery))
                            .map((layer) => (
                                <button
                                    key={layer}
                                    onClick={() => handleSelectMention(layer)}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[#e8e8f0] hover:bg-violet-600/25 hover:text-violet-300 transition-colors flex items-center gap-2"
                                >
                                    <span className="w-4 h-4 rounded bg-violet-600/30 text-violet-300 font-bold flex items-center justify-center text-[10px]">@</span>
                                    <span className="truncate font-medium">{layer}</span>
                                </button>
                            ))}
                    </div>
                )}

                <div
                    className={`flex items-end gap-2 p-2 rounded-xl border transition-all ${
                        loading
                            ? "border-[#2a2a38] bg-[#1a1a24]"
                            : "border-[#2a2a38] bg-[#1a1a24] focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/20"
                    }`}
                >
                    <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => {
                            if (e.target.value.length <= 500) handleTextChange(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            if ((e.key === "Enter" && !e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
                                e.preventDefault();
                                if (canSend) onSendMessage();
                            }
                        }}
                        placeholder={
                            hasHistory
                                ? "Berikan instruksi tambahan atau ketik @ untuk sebut layer…"
                                : "Jelaskan ide desain UMKM Anda (ketik @ untuk sebut layer)…"
                        }
                        rows={1}
                        disabled={loading}
                        className="flex-1 bg-transparent text-sm text-[#e8e8f0] placeholder-[#3a3a52] resize-none focus:outline-none disabled:opacity-50 leading-relaxed py-1"
                        style={{ minHeight: "36px", maxHeight: "160px" }}
                    />
                    <button
                        onClick={onSendMessage}
                        disabled={!canSend}
                        title="Kirim Perintah (Enter)"
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{
                            background: canSend
                                ? "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)"
                                : "#222230",
                            boxShadow: canSend
                                ? "0 0 12px rgba(124,58,237,0.4)"
                                : "none",
                        }}
                    >
                        {loading ? (
                            <svg className="w-3.5 h-3.5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        ) : (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-[#3a3a50] mt-1.5 text-center">
                    Tekan Enter untuk mengirim · Ketik @ untuk menyebut layer objek
                </p>
            </div>
        </div>
    );
}

// ─── Tab: Properties ──────────────────────────────────────────────────────────
interface PropertiesTabProps {
    selectedObject: FabricObject | null;
    onChangeProperty: (property: string, value: unknown) => void;
    onToggleLock: (obj: FabricObject) => void;
}

function PropertiesTab({
    selectedObject,
    onChangeProperty,
    onToggleLock,
}: PropertiesTabProps) {
    if (!selectedObject) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#222230] flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#3a3a50]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-[#6b6b80]">Belum Ada Elemen Dipilih</p>
                    <p className="text-xs text-[#3a3a50] mt-1 leading-relaxed">
                        Pilih salah satu elemen pada kanvas untuk mengubah propertinya (warna, posisi, teks).
                    </p>
                </div>
            </div>
        );
    }

    const type = selectedObject.type || "object";
    const isText = type.toLowerCase().includes("text");
    const locked = Boolean((selectedObject as { lockMovementX?: boolean }).lockMovementX);

    let rawFill = selectedObject.fill;
    let fillVal = "#000000";
    let isPattern = false;
    let patternLabel = "";

    if (typeof rawFill === "string") {
        if (rawFill.startsWith("url(") || rawFill.includes("#")) {
            if (rawFill.startsWith("url(")) {
                isPattern = true;
                const match = rawFill.match(/#([a-zA-Z0-9_-]+)/);
                patternLabel = match ? `Pattern (${match[1]})` : "SVG Pattern / Gradient";
            } else {
                fillVal = rawFill;
            }
        } else {
            fillVal = rawFill;
        }
    } else if (rawFill && typeof rawFill === "object") {
        isPattern = true;
        patternLabel = "Fabric Pattern / Gradient";
    }

    let textVal = "";
    if (isText && "text" in selectedObject) textVal = (selectedObject as { text?: string }).text || "";

    const x = Math.round(selectedObject.left || 0);
    const y = Math.round(selectedObject.top || 0);
    const w = Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1));
    const h = Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1));

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Properties header bar */}
            <div className="px-4 py-3 border-b border-[#2a2a38] flex items-center justify-between">
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-md bg-[#222230] text-[#c0c0d0] border border-[#2a2a38] capitalize">
                    {type}
                </span>
                <button
                    onClick={() => onToggleLock(selectedObject)}
                    title={locked ? "Unlock Layer" : "Lock Layer"}
                    className={`p-1.5 rounded-md transition-all ${locked ? "text-violet-400 bg-violet-900/30" : "text-[#6b6b80] hover:text-violet-400 hover:bg-violet-900/20"}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {locked ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        )}
                    </svg>
                </button>
            </div>

            <div className="p-4 space-y-5">
                {/* Fill Color */}
                <div className="space-y-2">
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-[#9090a8] block">Warna Isian</span>
                    {isPattern ? (
                        <div className="flex items-center justify-between p-2 rounded-lg border border-violet-500/30 bg-[#161622] text-xs">
                            <div className="flex items-center gap-2 truncate">
                                <span className="w-3.5 h-3.5 rounded bg-gradient-to-tr from-violet-500 to-indigo-500 shrink-0" />
                                <span className="text-violet-300 font-mono text-[11px] truncate">{patternLabel}</span>
                            </div>
                            <button
                                onClick={() => onChangeProperty("fill", "#3b82f6")}
                                className="px-2 py-0.5 text-[10px] font-semibold text-violet-300 hover:text-white bg-violet-900/40 hover:bg-violet-800/60 rounded border border-violet-700/50 transition-colors shrink-0"
                            >
                                Ubah Hex
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <div className="relative w-9 h-9 shrink-0">
                                <input
                                    type="color"
                                    value={fillVal.startsWith("#") && fillVal.length === 7 ? fillVal : "#000000"}
                                    onChange={(e) => onChangeProperty("fill", e.target.value)}
                                    className="absolute inset-0 w-full h-full rounded-lg cursor-pointer opacity-0"
                                />
                                <div
                                    className="w-full h-full rounded-lg border border-[#2a2a38] shadow-inner cursor-pointer"
                                    style={{ backgroundColor: fillVal.startsWith("#") && fillVal.length === 7 ? fillVal : "#000000" }}
                                />
                            </div>
                            <input
                                type="text"
                                value={fillVal}
                                onChange={(e) => onChangeProperty("fill", e.target.value)}
                                className="flex-1 px-2.5 py-1.5 text-xs border border-[#2a2a38] rounded-md bg-[#0d0d10] text-[#e8e8f0] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
                            />
                        </div>
                    )}
                </div>

                {/* Text Content */}
                {isText && (
                    <div className="space-y-2">
                        <span className="text-[10px] uppercase font-semibold tracking-widest text-[#9090a8] block">Isi Teks</span>
                        <textarea
                            value={textVal}
                            onChange={(e) => onChangeProperty("text", e.target.value)}
                            rows={3}
                            className="w-full px-2.5 py-2 text-xs border border-[#2a2a38] rounded-md bg-[#0d0d10] text-[#e8e8f0] focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 resize-y transition-colors"
                        />
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-[#2a2a38]" />

                {/* Position & Size */}
                <div className="space-y-3">
                    <span className="text-[10px] uppercase font-semibold tracking-widest text-[#9090a8] block">Posisi &amp; Ukuran</span>
                    <div className="grid grid-cols-2 gap-3">
                        <NumberField label="X" value={x} onChange={(v) => onChangeProperty("left", v)} />
                        <NumberField label="Y" value={y} onChange={(v) => onChangeProperty("top", v)} />
                        <NumberField label="W" value={w} onChange={(v) => onChangeProperty("width", v)} />
                        <NumberField label="H" value={h} onChange={(v) => onChangeProperty("height", v)} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function RightSidebar({
    selectedObject,
    onChangeProperty,
    onToggleLock,
    chatHistory,
    inputText,
    onInputChange,
    loading,
    onSendMessage,
    generateError,
    onClearChat,
    availableLayers = [],
    mobileOpen = false,
    onCloseMobile,
}: RightSidebarProps) {
    const [activeTab, setActiveTab] = useState<"chat" | "properties">("chat");

    // Auto-switch to Properties when user clicks an object
    useEffect(() => {
        if (selectedObject) setActiveTab("properties");
    }, [selectedObject]);

    const tabs = [
        {
            id: "chat" as const,
            label: "Obrolan AI",
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
            badge: chatHistory.length > 0,
        },
        {
            id: "properties" as const,
            label: "Properti Elemen",
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
            ),
            badge: selectedObject !== null,
        },
    ];

    return (
        <aside className={`bg-[#1a1a22] border-l border-[#2a2a38] flex flex-col h-full select-none transition-all duration-300 ${
            mobileOpen
                ? "fixed inset-y-0 right-0 z-50 w-80 shadow-2xl"
                : "hidden lg:flex w-72 shrink-0"
        }`}>
            {/* ── Tab Bar ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-[#2a2a38] shrink-0 px-2 pt-2 gap-1">
                <div className="flex items-stretch flex-1 gap-1">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all duration-150 ${
                                    isActive
                                        ? "bg-[#222230] text-[#e8e8f0] border border-b-0 border-[#2a2a38]"
                                        : "text-[#6b6b80] hover:text-[#c0c0d0] hover:bg-[#1e1e28]"
                                }`}
                            >
                                <span className={isActive ? "text-violet-400" : "text-[#4a4a60]"}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                                {tab.badge && (
                                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-400" />
                                )}
                                {isActive && (
                                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-violet-500" />
                                )}
                            </button>
                        );
                    })}
                </div>
                {onCloseMobile && (
                    <button
                        onClick={onCloseMobile}
                        className="lg:hidden p-1.5 text-[#808098] hover:text-white rounded-md mb-1"
                        title="Tutup Panel"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* ── Tab Content ──────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0">
                {activeTab === "chat" ? (
                    <AIChatTab
                        chatHistory={chatHistory}
                        inputText={inputText}
                        onInputChange={onInputChange}
                        loading={loading}
                        onSendMessage={onSendMessage}
                        generateError={generateError}
                        onClearChat={onClearChat}
                        availableLayers={availableLayers}
                    />
                ) : (
                    <PropertiesTab
                        selectedObject={selectedObject}
                        onChangeProperty={onChangeProperty}
                        onToggleLock={onToggleLock}
                    />
                )}
            </div>
        </aside>
    );
}
