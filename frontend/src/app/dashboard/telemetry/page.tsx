"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    ReactFlowProvider,
    Panel,
    type Node,
    type Edge,
    type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import {
    Activity, Loader2, Flame, Zap, WifiOff, Gauge, AlertTriangle,
    Trash2, Radio, ThermometerSun, BatteryWarning, Clock3,
} from "lucide-react";
import { systems as systemsApi, simulation as simApi, getErrorMessage } from "@/lib/api";
import { socket, joinSystemRoom, leaveSystemRoom } from "@/lib/socket";
import { getTemplate, CATEGORY_COLORS } from "@/lib/componentLibrary";
import MonitoringNode, { type MonitoringNodeData, type HealthStatus } from "@/components/telemetry/MonitoringNode";
import TelemetryDetailPanel from "@/components/telemetry/TelemetryDetailPanel";
import SystemHealthBar from "@/components/telemetry/SystemHealthBar";

// ─── Constants ──────────────────────────────────
const MAX_SPARKLINE = 30;
const nodeTypes = { monitoringNode: MonitoringNode };
const EDGE_IDLE = { stroke: "#262626", strokeWidth: 1.5, strokeDasharray: "6 4" };
const EDGE_ACTIVE = { stroke: "#22d3ee", strokeWidth: 2, strokeDasharray: "8 4" };
const EDGE_FAILURE = { stroke: "#ef4444", strokeWidth: 2.5, strokeDasharray: "4 3" };

// ─── Scenario Types ─────────────────────────────
const SCENARIO_TYPES = [
    { type: "sensor_failure", label: "Sensor Failure", icon: WifiOff, color: "#ef4444", desc: "Output becomes null — downstream loses data" },
    { type: "signal_noise", label: "Signal Noise", icon: Radio, color: "#f59e0b", desc: "Corrupted/noisy signal output" },
    { type: "voltage_drop", label: "Voltage Drop", icon: BatteryWarning, color: "#f97316", desc: "Power output drops by severity %" },
    { type: "motor_overload", label: "Motor Overload", icon: Flame, color: "#dc2626", desc: "Motor current spike → overloaded state" },
    { type: "network_delay", label: "Network Delay", icon: Gauge, color: "#8b5cf6", desc: "Add latency to communication modules" },
    { type: "component_overheat", label: "Component Overheat", icon: ThermometerSun, color: "#ef4444", desc: "Gradual temperature rise → thermal shutdown" },
];

// ─── Health logic ───────────────────────────────
function computeHealth(metric: string, value: number): HealthStatus {
    const ranges: Record<string, { warn: [number, number]; fail: [number, number] }> = {
        temperature: { warn: [-20, 80], fail: [-50, 120] },
        voltage: { warn: [1, 13], fail: [0, 25] },
        current: { warn: [0, 5], fail: [0, 10] },
        pressure: { warn: [0.5, 5], fail: [0, 10] },
        humidity: { warn: [10, 90], fail: [0, 100] },
        cpu_temp: { warn: [0, 75], fail: [0, 95] },
        latency: { warn: [0, 200], fail: [0, 500] },
        rpm: { warn: [0, 4000], fail: [0, 5500] },
        heat: { warn: [0, 60], fail: [0, 85] },
    };
    const r = ranges[metric];
    if (!r) return "healthy";
    if (value < r.fail[0] || value > r.fail[1]) return "failure";
    if (value < r.warn[0] || value > r.warn[1]) return "warning";
    return "healthy";
}

function formatValue(metric: string, value: number): string {
    const units: Record<string, string> = {
        temperature: "°C", voltage: "V", current: "A", pressure: "kPa",
        humidity: "%", cpu_temp: "°C", latency: "ms", power: "W",
        rpm: " RPM", heat: "°C", charge: "%", pwm_output: "",
    };
    return `${value.toFixed(1)}${units[metric] || ""}`;
}

// ─── Active Scenario Badge ──────────────────────
interface ActiveScenario { id: string; type: string; targetComponentId: string; severity: number }
interface StreamEvent {
    id: string;
    type: "telemetry" | "alert";
    componentId: string;
    metric: string;
    value: string;
    at: number;
}

// ─── Inner component ────────────────────────────
function TelemetryGraphInner() {
    const [systemsList, setSystemsList] = useState<any[]>([]);
    const [selectedSystem, setSelectedSystem] = useState("");
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [nodes, setNodes] = useState<Node<MonitoringNodeData>[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [alertCount, setAlertCount] = useState(0);
    const [scenarios, setScenarios] = useState<ActiveScenario[]>([]);
    const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scenarioBusy, setScenarioBusy] = useState(false);
    const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
    const evtCountRef = useRef(0);
    const [evtPerSec, setEvtPerSec] = useState(0);
    const loadedRef = useRef(false);

    // Throughput counter
    useEffect(() => {
        const interval = setInterval(() => {
            setEvtPerSec(evtCountRef.current);
            evtCountRef.current = 0;
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Load systems list
    useEffect(() => {
        setError(null);
        systemsApi.list().then((sys: any[]) => {
            setSystemsList(sys);
            if (sys.length > 0) setSelectedSystem(sys[0].id);
            setLoading(false);
        }).catch((err) => {
            setError(getErrorMessage(err, "Failed to load systems"));
            setLoading(false);
        });
    }, []);

    // Load selected system → build graph
    useEffect(() => {
        if (!selectedSystem) return;
        loadedRef.current = false;

        setError(null);
        systemsApi.get(selectedSystem).then((system: any) => {
            if (loadedRef.current) return;
            loadedRef.current = true;

            const newNodes: Node<MonitoringNodeData>[] = system.components.map((c: any) => ({
                id: c.id,
                type: "monitoringNode",
                position: { x: c.x, y: c.y },
                data: {
                    componentType: c.type,
                    label: c.name,
                    status: "idle" as HealthStatus,
                    liveValue: null,
                    liveMetric: null,
                    sparkline: [],
                    alertCount: 0,
                },
            }));

            const newEdges: Edge[] = system.connections.map((c: any) => ({
                id: c.id,
                source: c.sourceId,
                target: c.targetId,
                sourceHandle: c.sourcePin || undefined,
                targetHandle: c.targetPin || undefined,
                animated: false,
                style: EDGE_IDLE,
                type: "smoothstep",
            }));

            setNodes(newNodes);
            setEdges(newEdges);
            setSelectedNode(null);
            setAlertCount(0);
            setScenarios([]);
            setStreamEvents([]);

            // Load existing scenarios
            simApi.listScenarios(selectedSystem).then((scns: any[]) => setScenarios(scns)).catch(() => { });
        }).catch((err) => {
            console.error(err);
            setError(getErrorMessage(err, "Failed to load selected system"));
        });
    }, [selectedSystem]);

    // WebSocket subscription
    useEffect(() => {
        if (!selectedSystem) return;

        joinSystemRoom(selectedSystem);
        setConnected(socket.connected);

        const handleConnect = () => setConnected(true);
        const handleDisconnect = () => setConnected(false);

        const handleTelemetry = (tick: any) => {
            evtCountRef.current++;
            const { componentId, metric, value } = tick;
            if (!componentId || typeof value !== "number") return;

            const health = computeHealth(metric, value);
            const formatted = formatValue(metric, value);

            setNodes((prev) =>
                prev.map((n) => {
                    if (n.id !== componentId) return n;
                    const spark = [...n.data.sparkline, value].slice(-MAX_SPARKLINE);
                    return {
                        ...n,
                        data: { ...n.data, status: health, liveValue: formatted, liveMetric: metric, sparkline: spark },
                    };
                })
            );

            setEdges((prev) =>
                prev.map((e) => {
                    if (e.source === componentId || e.target === componentId) {
                        return { ...e, animated: true, style: health === "failure" ? EDGE_FAILURE : EDGE_ACTIVE };
                    }
                    return e;
                })
            );

            setStreamEvents((prev) => {
                const next = [{
                    id: `${Date.now()}-${componentId}-${metric}`,
                    type: "telemetry" as const,
                    componentId,
                    metric,
                    value: formatted,
                    at: Date.now(),
                }, ...prev];
                return next.slice(0, 140);
            });
        };

        const handleAlert = (alert: any) => {
            setAlertCount((c) => c + 1);
            if (alert.componentId) {
                setNodes((prev) =>
                    prev.map((n) => {
                        if (n.id !== alert.componentId) return n;
                        return { ...n, data: { ...n.data, status: "failure" as HealthStatus, alertCount: n.data.alertCount + 1 } };
                    })
                );

                setStreamEvents((prev) => {
                    const next = [{
                        id: `${Date.now()}-${alert.id || "alert"}`,
                        type: "alert" as const,
                        componentId: alert.componentId,
                        metric: "alert",
                        value: alert.message || "Alert triggered",
                        at: Date.now(),
                    }, ...prev];
                    return next.slice(0, 140);
                });
            }
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("telemetry:data", handleTelemetry);
        socket.on("alert:live", handleAlert);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("telemetry:data", handleTelemetry);
            socket.off("alert:live", handleAlert);
            leaveSystemRoom(selectedSystem);
        };
    }, [selectedSystem]);

    // ── Scenario Injection ────────────────────────
    const handleInjectScenario = async (type: string) => {
        if (!selectedNode || !selectedSystem) return;
        setScenarioBusy(true);
        setError(null);
        try {
            const result = await simApi.injectScenario(selectedSystem, {
                type,
                targetComponentId: selectedNode,
                severity: 0.8,
                durationTicks: -1,
            });
            setScenarios((prev) => [...prev, result.scenario]);
        } catch (err) {
            console.error("Failed to inject scenario", err);
            setError(getErrorMessage(err, "Failed to inject scenario"));
        } finally {
            setScenarioBusy(false);
        }
    };

    const handleRemoveScenario = async (scenarioId: string) => {
        if (!selectedSystem) return;
        setScenarioBusy(true);
        setError(null);
        try {
            await simApi.removeScenario(selectedSystem, scenarioId);
            setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
        } catch (err) {
            console.error("Failed to remove scenario", err);
            setError(getErrorMessage(err, "Failed to remove scenario"));
        } finally {
            setScenarioBusy(false);
        }
    };

    // Node click
    const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
        setSelectedNode(node.id);
    }, []);
    const handlePaneClick = useCallback(() => setSelectedNode(null), []);

    // Derived state
    const selectedNodeData = useMemo(() => {
        if (!selectedNode) return null;
        return nodes.find((n) => n.id === selectedNode) || null;
    }, [selectedNode, nodes]);

    const nodeStats = useMemo(() => {
        const s = { total: nodes.length, healthy: 0, warning: 0, failure: 0, idle: 0 };
        nodes.forEach((n) => { s[n.data.status]++; });
        return s;
    }, [nodes]);

    const selectedConnections = useMemo(() => {
        if (!selectedNode) return [];
        return edges
            .filter((e) => e.source === selectedNode || e.target === selectedNode)
            .map((e) => {
                const isSource = e.source === selectedNode;
                const otherNode = nodes.find((n) => n.id === (isSource ? e.target : e.source));
                return { label: otherNode?.data.label || "Unknown", direction: (isSource ? "out" : "in") as "in" | "out" };
            });
    }, [selectedNode, edges, nodes]);

    const scenariosForSelected = useMemo(() => {
        if (!selectedNode) return [];
        return scenarios.filter((s) => s.targetComponentId === selectedNode);
    }, [selectedNode, scenarios]);

    const componentHealthRows = useMemo(() => {
        const weight = { failure: 3, warning: 2, healthy: 1, idle: 0 } as const;
        return nodes
            .map((n) => ({
                id: n.id,
                label: n.data.label,
                type: n.data.componentType,
                status: n.data.status,
                liveMetric: n.data.liveMetric || "-",
                liveValue: n.data.liveValue || "-",
                alertCount: n.data.alertCount,
                weight: weight[n.data.status],
            }))
            .sort((a, b) => b.weight - a.weight || b.alertCount - a.alertCount || a.label.localeCompare(b.label));
    }, [nodes]);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-neutral-500"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...</div>;
    }

    const hasSystem = systemsList.length > 0 && selectedSystem;
    const hasNodes = nodes.length > 0;

    return (
        <div className="flex flex-col h-full -m-4 sm:-m-6">
            {/* ═══ TOP TOOLBAR ═══ */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800 shrink-0">
                <div>
                    <h1 className="text-lg font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">System Graph</h1>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Real-time signal propagation monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Scenario toggle */}
                    <button
                        onClick={() => setScenarioPanelOpen(!scenarioPanelOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${scenarioPanelOpen
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white hover:border-neutral-600"
                            }`}
                    >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Scenarios
                        {scenarios.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] rounded-full font-bold">{scenarios.length}</span>
                        )}
                    </button>

                    <select
                        value={selectedSystem}
                        onChange={(e) => setSelectedSystem(e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 min-w-35"
                    >
                        {systemsList.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${connected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }`}>
                        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                        {connected ? "Stream Active" : "Offline"}
                    </span>
                </div>
            </div>

            {error && (
                <div className="mx-4 mt-3 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
                    {error}
                </div>
            )}

            {/* ═══ MAIN BODY ═══ */}
            <div className="flex flex-1 overflow-hidden">
                {/* ── LEFT: Scenario Panel (collapsible) ── */}
                {scenarioPanelOpen && (
                    <div className="w-60 bg-neutral-950 border-r border-neutral-800 flex flex-col overflow-hidden shrink-0">
                        <div className="px-3 py-2.5 border-b border-neutral-800">
                            <h3 className="text-xs font-bold text-neutral-300">Scenario Injection</h3>
                            <p className="text-[9px] text-neutral-500 mt-0.5">
                                {selectedNode ? "Select a scenario to inject" : "Click a node first to target it"}
                            </p>
                        </div>

                        {/* Scenario type buttons */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {SCENARIO_TYPES.map((scn) => {
                                const Icon = scn.icon;
                                return (
                                    <button
                                        key={scn.type}
                                        onClick={() => handleInjectScenario(scn.type)}
                                        disabled={!selectedNode || scenarioBusy}
                                        className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left bg-neutral-900/50 border border-transparent hover:border-neutral-700 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all group"
                                    >
                                        <Icon className="h-4 w-4 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" style={{ color: scn.color }} />
                                        <div className="min-w-0">
                                            <span className="text-[11px] font-semibold text-neutral-200 block">{scn.label}</span>
                                            <span className="text-[9px] text-neutral-500 block mt-0.5 leading-tight">{scn.desc}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active scenarios list */}
                        {scenarios.length > 0 && (
                            <div className="border-t border-neutral-800 px-3 py-2 max-h-40 overflow-y-auto">
                                <span className="text-[9px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1.5">Active ({scenarios.length})</span>
                                {scenarios.map((s) => {
                                    const scnType = SCENARIO_TYPES.find((t) => t.type === s.type);
                                    const targetNode = nodes.find((n) => n.id === s.targetComponentId);
                                    return (
                                        <div key={s.id} className="flex items-center justify-between gap-1 py-1 text-[10px]">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse" style={{ background: scnType?.color || "#ef4444" }} />
                                                <span className="text-neutral-300 truncate">{scnType?.label}</span>
                                                <span className="text-neutral-600 truncate">→ {targetNode?.data.label || "?"}</span>
                                            </div>
                                            <button onClick={() => handleRemoveScenario(s.id)} className="p-0.5 text-neutral-500 hover:text-rose-400 transition-colors shrink-0">
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── CENTER: Graph Canvas ── */}
                <div className="flex-1 relative">
                    {!hasSystem ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-600">
                            <Activity className="h-16 w-16 mb-4" />
                            <p className="text-sm">No systems found.</p>
                            <p className="text-xs mt-1">Create a system and start a simulation to see the graph.</p>
                        </div>
                    ) : !hasNodes ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-600">
                            <Activity className="h-16 w-16 mb-4 animate-pulse" />
                            <p className="text-sm">No components in this system.</p>
                            <p className="text-xs mt-1">Add components in the System Builder, save, then start a simulation.</p>
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            onNodeClick={handleNodeClick}
                            onPaneClick={handlePaneClick}
                            fitView
                            proOptions={{ hideAttribution: true }}
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable={true}
                            panOnDrag
                            zoomOnScroll
                            minZoom={0.3}
                            maxZoom={2}
                        >
                            <Background color="#111" gap={24} size={1} />
                            <Controls className="bg-neutral-900! border-neutral-700! rounded-lg! shadow-xl!" showInteractive={false} />
                            <MiniMap
                                nodeColor={(n: any) => {
                                    const status = n.data?.status as HealthStatus;
                                    const colors: Record<HealthStatus, string> = { healthy: "#22c55e", warning: "#eab308", failure: "#ef4444", idle: "#525252" };
                                    return colors[status] || "#525252";
                                }}
                                maskColor="rgba(0,0,0,0.85)"
                                className="bg-neutral-900/90! border-neutral-700! rounded-lg!"
                                style={{ width: 140, height: 90 }}
                            />
                            <Panel position="top-left" className="m-3!">
                                <div className="flex items-center gap-3 text-[10px] text-neutral-500 bg-neutral-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-neutral-800">
                                    <span>{nodes.length} nodes</span>
                                    <span className="text-neutral-700">|</span>
                                    <span>{edges.length} edges</span>
                                    <span className="text-neutral-700">|</span>
                                    <span className="text-cyan-400">{evtPerSec.toFixed(0)} evt/s</span>
                                    {scenarios.length > 0 && (
                                        <>
                                            <span className="text-neutral-700">|</span>
                                            <span className="text-rose-400">{scenarios.length} scenarios</span>
                                        </>
                                    )}
                                </div>
                            </Panel>
                        </ReactFlow>
                    )}
                </div>

                {/* ── RIGHT: Detail Panel ── */}
                {selectedNodeData && (
                    <div className="w-72 xl:w-80 border-l border-neutral-800 overflow-hidden shrink-0 hidden md:flex md:flex-col">
                        <TelemetryDetailPanel
                            nodeId={selectedNodeData.id}
                            label={selectedNodeData.data.label}
                            componentType={selectedNodeData.data.componentType}
                            status={selectedNodeData.data.status}
                            liveValue={selectedNodeData.data.liveValue}
                            sparkline={selectedNodeData.data.sparkline}
                            connections={selectedConnections}
                            alertCount={selectedNodeData.data.alertCount}
                            onClose={() => setSelectedNode(null)}
                        />

                        {/* Scenarios for this node */}
                        {scenariosForSelected.length > 0 && (
                            <div className="border-t border-rose-500/20 bg-rose-500/5 px-4 py-2 shrink-0">
                                <span className="text-[9px] text-rose-400 uppercase tracking-wider font-bold block mb-1">Active Scenarios</span>
                                {scenariosForSelected.map((s) => {
                                    const scnType = SCENARIO_TYPES.find((t) => t.type === s.type);
                                    return (
                                        <div key={s.id} className="flex items-center justify-between py-0.5">
                                            <span className="text-xs text-rose-300 flex items-center gap-1.5">
                                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                {scnType?.label || s.type}
                                            </span>
                                            <button onClick={() => handleRemoveScenario(s.id)} className="text-[10px] text-neutral-500 hover:text-rose-400">Remove</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {hasSystem && hasNodes && (
                <div className="border-t border-neutral-800 bg-neutral-950/80 px-4 py-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="border border-neutral-800 rounded-lg bg-neutral-900/40 overflow-hidden">
                        <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                            <div className="text-xs font-semibold text-neutral-300 flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-cyan-400" /> Live Stream Events</div>
                            <div className="text-[10px] text-neutral-500">Last {streamEvents.length}</div>
                        </div>
                        <div className="max-h-44 overflow-y-auto text-xs">
                            {streamEvents.length === 0 && (
                                <div className="px-3 py-4 text-neutral-500">Waiting for telemetry stream...</div>
                            )}
                            {streamEvents.map((evt) => {
                                const component = nodes.find((n) => n.id === evt.componentId);
                                return (
                                    <div key={evt.id} className="px-3 py-2 border-b border-neutral-900 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className={`font-medium ${evt.type === "alert" ? "text-rose-300" : "text-neutral-200"}`}>
                                                {component?.data.label || evt.componentId}
                                            </div>
                                            <div className="text-neutral-500 truncate">{evt.metric}: {evt.value}</div>
                                        </div>
                                        <div className="text-[10px] text-neutral-600 shrink-0">{new Date(evt.at).toLocaleTimeString()}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border border-neutral-800 rounded-lg bg-neutral-900/40 overflow-hidden">
                        <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                            <div className="text-xs font-semibold text-neutral-300">Component Health Matrix</div>
                            <div className="text-[10px] text-neutral-500">Sorted by risk</div>
                        </div>
                        <div className="max-h-44 overflow-y-auto text-xs">
                            {componentHealthRows.map((row) => (
                                <div key={row.id} className="px-3 py-2 border-b border-neutral-900 grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-4 min-w-0">
                                        <div className="text-neutral-200 font-medium truncate">{row.label}</div>
                                        <div className="text-neutral-600 truncate">{row.type}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${row.status === "failure" ? "bg-rose-500/20 text-rose-300" : row.status === "warning" ? "bg-amber-500/20 text-amber-300" : row.status === "healthy" ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700/40 text-neutral-400"}`}>{row.status}</span>
                                    </div>
                                    <div className="col-span-3 text-neutral-400 truncate">{row.liveMetric}</div>
                                    <div className="col-span-2 text-neutral-300 truncate">{row.liveValue}</div>
                                    <div className="col-span-1 text-right text-rose-300">{row.alertCount > 0 ? row.alertCount : "-"}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ BOTTOM: Health Bar ═══ */}
            {hasSystem && hasNodes && (
                <SystemHealthBar
                    systemName={systemsList.find((s: any) => s.id === selectedSystem)?.name || ""}
                    stats={nodeStats}
                    alertCount={alertCount}
                    eventsPerSec={evtPerSec}
                    connected={connected}
                />
            )}
        </div>
    );
}

// ─── Page Export ─────────────────────────────────
export default function TelemetryPage() {
    return (
        <ReactFlowProvider>
            <TelemetryGraphInner />
        </ReactFlowProvider>
    );
}
