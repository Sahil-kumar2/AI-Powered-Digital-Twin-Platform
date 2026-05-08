"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    type Connection,
    type NodeMouseHandler,
    ReactFlowProvider,
    Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import {
    ArrowLeft, Play, Square, Save, Loader2, Undo2, Redo2,
    Search, ChevronDown, ChevronUp, ShieldCheck, Terminal,
    AlertTriangle, Info, CheckCircle, XCircle,
} from "lucide-react";
import Link from "next/link";

import ComponentNode from "@/components/builder/ComponentNode";
import PropertiesPanel from "@/components/builder/PropertiesPanel";
import { useBuilderStore, type BuilderNodeData } from "@/lib/builderStore";
import {
    COMPONENT_LIBRARY, CATEGORIES, CATEGORY_COLORS,
    getTemplate, type ComponentTemplate,
} from "@/lib/componentLibrary";
import { validateSystem } from "@/lib/validator";
import { systems as systemsApi, simulation as simApi, getErrorMessage } from "@/lib/api";
import { socket, joinSystemRoom, leaveSystemRoom } from "@/lib/socket";

// ─── Edge defaults ──────────────────────────────
const edgeDefaults = { animated: true, style: { stroke: "#22d3ee", strokeWidth: 2 }, type: "smoothstep" as const };

// ─── Node types ─────────────────────────────────
const nodeTypes = { componentNode: ComponentNode };

// ─── Builder Inner (must be inside ReactFlowProvider) ─
function BuilderInner() {
    const params = useParams();
    const systemId = params.id as string;

    // Store
    const store = useBuilderStore();
    const {
        systemName, nodes, edges, selectedNodeId, simRunning, logs, isDirty,
        init, onNodesChange, onEdgesChange, onConnect, selectNode, addComponentNode,
        removeSelectedNode, setSimRunning, setNodeStatus, resetAllStatus,
        addLog, undo, redo, past, future,
    } = store;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));
    const [logsOpen, setLogsOpen] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const loadedRef = useRef(false); // Prevent double-load in StrictMode

    // ── Load system (once only) ────────────────────
    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;

        const loadSystem = async () => {
            try {
                const system = await systemsApi.get(systemId);

                const loadedNodes = system.components.map((c: any) => ({
                    id: c.id,
                    type: "componentNode",
                    position: { x: c.x, y: c.y },
                    data: {
                        componentType: c.type,
                        label: c.name,
                        params: c.parameters ? JSON.parse(c.parameters) : {},
                        status: "idle" as const,
                    },
                }));

                const loadedEdges = system.connections.map((c: any) => ({
                    id: c.id,
                    source: c.sourceId,
                    target: c.targetId,
                    sourceHandle: c.sourcePin || undefined,
                    targetHandle: c.targetPin || undefined,
                    ...edgeDefaults,
                }));

                init(systemId, system.name, loadedNodes, loadedEdges);

                // Check sim status
                try {
                    const status = await simApi.status(systemId);
                    setSimRunning(status.status === "running");
                } catch { }

                addLog("info", `System "${system.name}" loaded — ${loadedNodes.length} components, ${loadedEdges.length} connections`);
            } catch (err) {
                console.error("Failed to load system", err);
                addLog("error", getErrorMessage(err, "Failed to load system from server"));
            } finally {
                setLoading(false);
            }
        };
        loadSystem();
    }, [systemId]);

    // ── WebSocket: live node status during simulation ─
    useEffect(() => {
        if (!simRunning || !systemId) return;
        joinSystemRoom(systemId);

        const handleTelemetry = (tick: any) => {
            if (tick.componentId) {
                const value = tick.value;
                if (typeof value === "number") {
                    if (value > 100 || value < -50) setNodeStatus(tick.componentId, "failure");
                    else if (value > 80 || value < -20) setNodeStatus(tick.componentId, "warning");
                    else setNodeStatus(tick.componentId, "healthy");
                }
            }
        };

        const handleAlert = (alert: any) => {
            if (alert.componentId) setNodeStatus(alert.componentId, "failure");
            addLog("error", `ALERT: ${alert.message}`);
        };

        socket.on("telemetry:data", handleTelemetry);
        socket.on("alert:live", handleAlert);

        return () => {
            socket.off("telemetry:data", handleTelemetry);
            socket.off("alert:live", handleAlert);
            leaveSystemRoom(systemId);
        };
    }, [simRunning, systemId]);

    // ── Keyboard shortcuts ─────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSave(); }
            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedNodeId && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
                    removeSelectedNode();
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [selectedNodeId, undo, redo]);

    // ── Auto-scroll logs ──────────────
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // ── Connection handler ─────────────
    const handleConnect = useCallback(
        (conn: Connection) => { onConnect(conn); },
        [onConnect]
    );

    const handleNodeClick: NodeMouseHandler = useCallback(
        (_e, node) => { selectNode(node.id); },
        [selectNode]
    );

    const handlePaneClick = useCallback(() => { selectNode(null); }, [selectNode]);

    // ── Add component (local only — no backend call until Save) ─
    const handleAddComponent = (template: ComponentTemplate) => {
        const x = 300 + Math.random() * 400;
        const y = 100 + Math.random() * 350;
        const tempId = crypto.randomUUID();
        addComponentNode(template, x, y, tempId);
    };

    // ── SAVE — persist everything to backend in one call ─
    const handleSave = async () => {
        setSaving(true);
        addLog("info", "Saving system...");
        try {
            const comps = nodes.map((n) => ({
                id: n.id,
                type: n.data.componentType,
                name: n.data.label,
                x: n.position.x,
                y: n.position.y,
                parameters: JSON.stringify(n.data.params || {}),
            }));

            const conns = edges.map((e) => ({
                id: e.id,
                sourceId: e.source,
                targetId: e.target,
                sourceHandle: e.sourceHandle || null,
                targetHandle: e.targetHandle || null,
            }));

            await systemsApi.save(systemId, comps, conns);
            store.setDirty(false);
            addLog("success", `Saved ${comps.length} components and ${conns.length} connections`);
        } catch (err: any) {
            console.error("Save failed", err);
            addLog("error", `Save failed: ${getErrorMessage(err)}`);
        } finally {
            setSaving(false);
        }
    };

    // ── Validate ───────────────────────
    const handleValidate = () => {
        const messages = validateSystem(nodes, edges);
        messages.forEach((m) => {
            addLog(m.level === "error" ? "error" : m.level === "warning" ? "warn" : "info", m.message);
        });
        const errors = messages.filter((m) => m.level === "error").length;
        if (errors > 0) addLog("error", `Validation found ${errors} error(s)`);
    };

    // ── Simulation toggle ─────────────
    const handleToggleSimulation = async () => {
        try {
            if (simRunning) {
                await simApi.stop(systemId);
                setSimRunning(false);
                resetAllStatus();
                addLog("info", "Simulation stopped");
            } else {
                // Auto-save before simulation
                if (isDirty) {
                    addLog("info", "Auto-saving before simulation...");
                    await handleSave();
                }
                const messages = validateSystem(nodes, edges);
                const errors = messages.filter((m) => m.level === "error");
                if (errors.length > 0) {
                    errors.forEach((e) => addLog("error", e.message));
                    addLog("error", "Fix validation errors before running simulation");
                    return;
                }
                await simApi.start(systemId, 1000);
                setSimRunning(true);
                addLog("success", "Simulation started");
            }
        } catch (err: any) {
            addLog("error", getErrorMessage(err, "Simulation toggle failed"));
        }
    };

    // ── Category toggle ────────────────
    const toggleCategory = (cat: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    };

    // ── Filtered library ───────────────
    const filteredLibrary = useMemo(() => {
        if (!searchQuery) return COMPONENT_LIBRARY;
        const q = searchQuery.toLowerCase();
        return COMPONENT_LIBRARY.filter(
            (c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // ── Log icon ───────────────────────
    const logIcon = (level: string) => {
        switch (level) {
            case "error": return <XCircle className="h-3 w-3 text-rose-500 shrink-0" />;
            case "warn": return <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />;
            case "success": return <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />;
            default: return <Info className="h-3 w-3 text-blue-400 shrink-0" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading system...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full -m-4 sm:-m-6">
            {/* ═══ TOP TOOLBAR ═══ */}
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-950 border-b border-neutral-800 shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Link href="/dashboard/systems" className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="font-bold text-sm sm:text-lg truncate">{systemName}</h1>
                    {isDirty && <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes"></span>}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                    <button onClick={undo} disabled={past.length === 0} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors disabled:opacity-30" title="Undo (Ctrl+Z)">
                        <Undo2 className="h-4 w-4" />
                    </button>
                    <button onClick={redo} disabled={future.length === 0} className="p-2 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
                        <Redo2 className="h-4 w-4" />
                    </button>

                    <div className="w-px h-6 bg-neutral-800 mx-1 hidden sm:block"></div>

                    <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs sm:text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-neutral-700" title="Save (Ctrl+S)">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Save</span>
                    </button>

                    <button onClick={handleValidate} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs sm:text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors border border-neutral-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Validate</span>
                    </button>

                    <button
                        onClick={handleToggleSimulation}
                        className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${simRunning
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                            }`}
                    >
                        {simRunning ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Simulate</>}
                    </button>
                </div>
            </div>

            {/* ═══ MAIN BODY ═══ */}
            <div className="flex flex-1 overflow-hidden">
                {/* ── LEFT: Component Library ── */}
                <div className="w-56 bg-neutral-950 border-r border-neutral-800 flex flex-col overflow-hidden shrink-0 hidden md:flex">
                    <div className="p-3 border-b border-neutral-800">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                            <input
                                type="text"
                                placeholder="Search components..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-cyan-500 text-white placeholder:text-neutral-600"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {CATEGORIES.map((cat) => {
                            const items = filteredLibrary.filter((c) => c.category === cat);
                            if (items.length === 0) return null;
                            const isExpanded = expandedCategories.has(cat);
                            const catColor = CATEGORY_COLORS[cat];

                            return (
                                <div key={cat} className="mb-1">
                                    <button
                                        onClick={() => toggleCategory(cat)}
                                        className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors rounded"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-sm" style={{ background: catColor }}></span>
                                            {cat}
                                            <span className="text-neutral-600 font-normal">({items.length})</span>
                                        </span>
                                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                            {items.map((comp) => {
                                                const Icon = comp.icon;
                                                return (
                                                    <button
                                                        key={comp.type}
                                                        onClick={() => handleAddComponent(comp)}
                                                        className="flex items-center gap-2 px-3 py-2 bg-neutral-900/50 border border-transparent hover:border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all text-left group"
                                                    >
                                                        <Icon className="h-3.5 w-3.5 shrink-0 group-hover:scale-110 transition-transform" style={{ color: comp.color }} />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="truncate font-medium">{comp.name}</span>
                                                            <span className="text-[9px] text-neutral-600 truncate">{comp.ports.length} ports</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── CENTER: Canvas ── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 relative">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={handleConnect}
                            onNodeClick={handleNodeClick}
                            onPaneClick={handlePaneClick}
                            nodeTypes={nodeTypes}
                            fitView
                            snapToGrid
                            snapGrid={[20, 20]}
                            deleteKeyCode="Delete"
                            proOptions={{ hideAttribution: true }}
                            defaultEdgeOptions={edgeDefaults}
                        >
                            <Background color="#1a1a1a" gap={20} size={1} />
                            <Controls className="!bg-neutral-900 !border-neutral-700 !rounded-lg !shadow-xl" showInteractive={false} />
                            <MiniMap
                                nodeColor={(n) => {
                                    const t = getTemplate((n.data as BuilderNodeData)?.componentType);
                                    return t ? CATEGORY_COLORS[t.category] || "#525252" : "#525252";
                                }}
                                maskColor="rgba(0,0,0,0.8)"
                                className="!bg-neutral-900/80 !border-neutral-700 !rounded-lg"
                                style={{ width: 150, height: 100 }}
                            />

                            <Panel position="top-left" className="!m-3">
                                <div className="flex items-center gap-3 text-[10px] text-neutral-500 bg-neutral-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-neutral-800">
                                    <span>{nodes.length} components</span>
                                    <span className="text-neutral-700">|</span>
                                    <span>{edges.length} connections</span>
                                    {simRunning && (
                                        <>
                                            <span className="text-neutral-700">|</span>
                                            <span className="text-emerald-400 flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                Simulation Running
                                            </span>
                                        </>
                                    )}
                                </div>
                            </Panel>
                        </ReactFlow>
                    </div>

                    {/* ── BOTTOM: Logs Panel ── */}
                    <div className={`border-t border-neutral-800 bg-neutral-950 transition-all ${logsOpen ? "h-36" : "h-8"} shrink-0`}>
                        <button
                            onClick={() => setLogsOpen(!logsOpen)}
                            className="flex items-center justify-between w-full px-4 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-900/50"
                        >
                            <span className="flex items-center gap-2 font-semibold">
                                <Terminal className="h-3.5 w-3.5" /> System Logs
                                {logs.filter((l) => l.level === "error").length > 0 && (
                                    <span className="px-1.5 py-0.5 text-[9px] bg-rose-500/20 text-rose-400 rounded-full font-bold">
                                        {logs.filter((l) => l.level === "error").length}
                                    </span>
                                )}
                            </span>
                            {logsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </button>

                        {logsOpen && (
                            <div className="h-[calc(100%-28px)] overflow-y-auto px-4 py-1 font-mono text-[11px] space-y-0.5">
                                {logs.length === 0 ? (
                                    <p className="text-neutral-600 py-2">No events yet. Add components and start building.</p>
                                ) : (
                                    logs.map((log) => (
                                        <div key={log.id} className="flex items-start gap-2 py-0.5">
                                            {logIcon(log.level)}
                                            <span className="text-neutral-600">[{log.time}]</span>
                                            <span className={
                                                log.level === "error" ? "text-rose-400" :
                                                    log.level === "warn" ? "text-amber-400" :
                                                        log.level === "success" ? "text-emerald-400" :
                                                            "text-neutral-400"
                                            }>{log.message}</span>
                                        </div>
                                    ))
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Properties Panel ── */}
                <div className="w-72 bg-neutral-950 border-l border-neutral-800 overflow-hidden shrink-0 hidden lg:flex lg:flex-col">
                    <PropertiesPanel />
                </div>
            </div>
        </div>
    );
}

// ─── Page Export ─────────────────────────────────
export default function SystemBuilderPage() {
    return (
        <ReactFlowProvider>
            <BuilderInner />
        </ReactFlowProvider>
    );
}
