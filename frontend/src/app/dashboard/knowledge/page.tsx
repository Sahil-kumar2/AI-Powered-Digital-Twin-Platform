"use client";
import React, { useState } from "react";
import { Search, FileText, Loader2, BookOpen } from "lucide-react";
import { ai, systems, getErrorMessage } from "@/lib/api";

type SystemSummary = {
    id: string;
    name: string;
};

export default function KnowledgeBasePage() {
    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [activeSystemId, setActiveSystemId] = useState<string>("");
    const [systemsList, setSystemsList] = useState<SystemSummary[]>([]);
    const [results, setResults] = useState<Array<{ id: string; text: string; score: number; metadata?: Record<string, unknown> }>>([]);
    const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [aiFallbackNotice, setAiFallbackNotice] = useState<string | null>(null);

    React.useEffect(() => {
        setLoadError(null);
        systems.list().then((list) => {
            setSystemsList(list);
            if (list.length > 0) setActiveSystemId(list[0].id);
        }).catch((err) => {
            setLoadError(getErrorMessage(err, "Failed to load systems"));
        });
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = query.trim();
        if (!text || searching) return;
        setSearching(true);
        setAiFallbackNotice(null);
        setLoadError(null);

        try {
            const namespace = activeSystemId ? `system-${activeSystemId}` : "global";
            const response = await ai.searchKnowledge(text, namespace, 10);
            const matches = (response?.matches || []).map((m: any) => ({
                id: m.id,
                text: m.text,
                score: Number(m.score || 0),
                metadata: m.metadata || {},
            }));
            setResults(matches);
            setSelectedResultId(matches.length > 0 ? matches[0].id : null);
            if (response?.fallback) {
                setAiFallbackNotice("AI service is unavailable right now. Showing fallback/local knowledge results.");
            }
        } catch (err: unknown) {
            setLoadError(getErrorMessage(err, "Failed to search knowledge"));
        } finally {
            setSearching(false);
        }
    };

    const selectedResult = results.find((r) => r.id === selectedResultId) || null;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Knowledge Base (RAG)</h1>
                <p className="text-neutral-400 text-sm mt-1 mb-4">Search indexed engineering documents and inspect source details.</p>
                {loadError && <div className="mb-3 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">{loadError}</div>}
                {aiFallbackNotice && <div className="mb-3 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">{aiFallbackNotice}</div>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
                    <label className="text-xs text-neutral-500 mb-1 block">Context System</label>
                    <select
                        value={activeSystemId}
                        onChange={(e) => setActiveSystemId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md py-2 px-3 text-sm md:col-span-1"
                    >
                        {systemsList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <form onSubmit={handleSearch} className="md:col-span-2">
                        <label className="text-xs text-neutral-500 mb-1 block">Search Query</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. voltage regulator thermal derating"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 pl-10 pr-24 text-sm focus:outline-none focus:border-cyan-500"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 rounded-md text-xs font-semibold inline-flex items-center gap-1">
                                {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Search
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-5">
                <div className="lg:col-span-2 border-r border-neutral-800 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-neutral-800 text-sm font-semibold text-neutral-300 flex items-center justify-between">
                        <span>Result List</span>
                        <span className="text-xs text-neutral-500">{results.length} matches</span>
                    </div>
                    {results.length === 0 ? (
                        <div className="p-6 text-sm text-neutral-500">Run a search to see matching knowledge documents.</div>
                    ) : (
                        results.map((item) => {
                            const selected = item.id === selectedResultId;
                            return (
                                <button key={item.id} onClick={() => setSelectedResultId(item.id)} className={`w-full text-left px-4 py-3 border-b border-neutral-800/70 hover:bg-neutral-800/40 ${selected ? "bg-cyan-950/20 border-l-2 border-l-cyan-500" : ""}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-neutral-200 truncate">{(item.metadata?.title as string) || "Untitled document"}</div>
                                            <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{item.text}</div>
                                        </div>
                                        <span className="text-[10px] text-cyan-300 bg-cyan-900/30 px-2 py-0.5 rounded">{item.score.toFixed(3)}</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="lg:col-span-3 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-neutral-800 text-sm font-semibold text-neutral-300 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-cyan-400" /> Document Details
                    </div>
                    {!selectedResult ? (
                        <div className="p-8 text-neutral-500 text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" /> Select a result to inspect details.</div>
                    ) : (
                        <div className="p-5 space-y-4">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-100">{(selectedResult.metadata?.title as string) || "Untitled document"}</h2>
                                <p className="text-xs text-neutral-500 mt-1">Match score: {selectedResult.score.toFixed(3)} | ID: {selectedResult.id}</p>
                            </div>

                            <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-4 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                {selectedResult.text || "No text available"}
                            </div>

                            <div>
                                <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Metadata</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Object.entries(selectedResult.metadata || {}).length === 0 && (
                                        <div className="text-xs text-neutral-500">No metadata provided</div>
                                    )}
                                    {Object.entries(selectedResult.metadata || {}).map(([k, v]) => (
                                        <div key={k} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
                                            <div className="text-[11px] text-neutral-500">{k}</div>
                                            <div className="text-sm text-neutral-200 truncate">{String(v)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
