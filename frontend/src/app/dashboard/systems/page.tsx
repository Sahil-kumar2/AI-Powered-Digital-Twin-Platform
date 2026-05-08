"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Cpu, Plus, LayoutGrid, Trash2, Loader2 } from "lucide-react";
import { systems as systemsApi, getErrorMessage } from "@/lib/api";

interface System {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export default function SystemsPage() {
    const [systemsList, setSystemsList] = useState<System[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSystems = async () => {
        setError(null);
        try {
            const data = await systemsApi.list();
            setSystemsList(data);
        } catch (err) {
            console.error("Failed to load systems", err);
            setError(getErrorMessage(err, "Failed to load systems"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSystems(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        setError(null);
        try {
            await systemsApi.create(newName, newDesc);
            setNewName("");
            setNewDesc("");
            setShowCreate(false);
            await fetchSystems();
        } catch (err) {
            console.error("Create failed", err);
            setError(getErrorMessage(err, "Failed to create system"));
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this system and all its components?")) return;
        setError(null);
        try {
            await systemsApi.delete(id);
            await fetchSystems();
        } catch (err) {
            console.error("Delete failed", err);
            setError(getErrorMessage(err, "Failed to delete system"));
        }
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Systems Managed</h1>
                    <p className="text-neutral-400 text-sm mt-1">Manage your electronic system digital twins.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-lg text-sm flex items-center gap-2 transition-colors"
                >
                    <Plus className="h-4 w-4" /> New System
                </button>
            </div>

            {error && (
                <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
                    <div className="flex items-center justify-between gap-2">
                        <span>{error}</span>
                        <button onClick={() => { setLoading(true); void fetchSystems(); }} className="rounded-md border border-rose-700/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/30">
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleCreate}
                        className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md flex flex-col gap-4"
                    >
                        <h2 className="text-lg font-bold">Create New System</h2>
                        <input
                            type="text"
                            placeholder="System name (e.g., Smart HVAC Monitor)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-cyan-500"
                            autoFocus
                            required
                        />
                        <textarea
                            placeholder="Description (optional)"
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-cyan-500 resize-none h-20"
                        />
                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">Cancel</button>
                            <button type="submit" disabled={creating} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 transition-colors">
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-16 text-neutral-500">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading systems...
                </div>
            )}

            {/* Empty State */}
            {!loading && systemsList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-500 gap-4">
                    <LayoutGrid className="h-12 w-12 text-neutral-700" />
                    <p>No systems yet. Create your first digital twin!</p>
                    <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold rounded-lg text-sm flex items-center gap-2 transition-colors">
                        <Plus className="h-4 w-4" /> Create System
                    </button>
                </div>
            )}

            {/* Systems Grid */}
            {!loading && systemsList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {systemsList.map((sys) => (
                        <div key={sys.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors group relative">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-neutral-950 rounded-lg group-hover:bg-cyan-950/30 transition-colors">
                                        <Cpu className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-neutral-100">{sys.name}</h3>
                                        <p className="text-xs text-neutral-500">{sys.description || "No description"}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(sys.id)}
                                    className="p-1.5 text-neutral-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete system"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="text-xs text-neutral-500 mb-4">Created {new Date(sys.createdAt).toLocaleDateString()}</p>
                            <div className="flex gap-2">
                                <Link
                                    href={`/dashboard/systems/${sys.id}/builder`}
                                    className="flex-1 text-center px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded-lg transition-colors border border-neutral-700"
                                >
                                    Open Builder
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
