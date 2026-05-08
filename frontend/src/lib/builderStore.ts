import { create } from "zustand";
import {
    type Edge,
    type Node,
    type Connection,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    type NodeChange,
    type EdgeChange,
} from "reactflow";
import { getTemplate, areSignalsCompatible, type ComponentTemplate } from "./componentLibrary";

// ─── Types ──────────────────────────────────────
export type NodeStatus = "idle" | "healthy" | "warning" | "failure";

export interface BuilderNodeData {
    componentType: string;
    label: string;
    params: Record<string, any>;
    status: NodeStatus;
}

export interface LogEntry {
    id: string;
    time: string;
    level: "info" | "warn" | "error" | "success";
    message: string;
}

interface HistorySnapshot {
    nodes: Node<BuilderNodeData>[];
    edges: Edge[];
}

// ─── Store ──────────────────────────────────────
interface BuilderStore {
    // State
    systemId: string;
    systemName: string;
    nodes: Node<BuilderNodeData>[];
    edges: Edge[];
    selectedNodeId: string | null;
    simRunning: boolean;
    logs: LogEntry[];
    isDirty: boolean;

    // History
    past: HistorySnapshot[];
    future: HistorySnapshot[];

    // Actions — init
    init: (systemId: string, systemName: string, nodes: Node<BuilderNodeData>[], edges: Edge[]) => void;

    // Actions — nodes
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    addComponentNode: (template: ComponentTemplate, x: number, y: number, backendId: string) => void;
    removeSelectedNode: () => void;
    selectNode: (id: string | null) => void;
    updateNodeParams: (nodeId: string, params: Record<string, any>) => void;
    updateNodeLabel: (nodeId: string, label: string) => void;

    // Actions — edges
    onConnect: (connection: Connection) => boolean; // returns false if invalid

    // Actions — simulation
    setSimRunning: (running: boolean) => void;
    setNodeStatus: (nodeId: string, status: NodeStatus) => void;
    resetAllStatus: () => void;

    // Actions — logs
    addLog: (level: LogEntry["level"], message: string) => void;
    clearLogs: () => void;

    // Actions — history
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;

    // Derived
    setDirty: (dirty: boolean) => void;
}

const MAX_HISTORY = 50;

export const useBuilderStore = create<BuilderStore>((set, get) => ({
    systemId: "",
    systemName: "",
    nodes: [],
    edges: [],
    selectedNodeId: null,
    simRunning: false,
    logs: [],
    isDirty: false,
    past: [],
    future: [],

    init: (systemId, systemName, nodes, edges) =>
        set({ systemId, systemName, nodes, edges, selectedNodeId: null, simRunning: false, logs: [], isDirty: false, past: [], future: [] }),

    // ── Node Changes ──────────────────
    onNodesChange: (changes) =>
        set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes) as Node<BuilderNodeData>[],
            isDirty: true,
        })),

    onEdgesChange: (changes) =>
        set((state) => ({
            edges: applyEdgeChanges(changes, state.edges),
            isDirty: true,
        })),

    addComponentNode: (template, x, y, backendId) => {
        const { nodes } = get();
        // Count existing of same type for naming
        const count = nodes.filter((n) => n.data.componentType === template.type).length;
        const label = `${template.name} ${count + 1}`;

        // Build default params
        const params: Record<string, any> = {};
        template.params.forEach((p) => { params[p.key] = p.defaultValue; });

        const newNode: Node<BuilderNodeData> = {
            id: backendId,
            type: "componentNode",
            position: { x, y },
            data: {
                componentType: template.type,
                label,
                params,
                status: "idle",
            },
        };

        get().pushHistory();
        set((state) => ({
            nodes: [...state.nodes, newNode],
            isDirty: true,
        }));
        get().addLog("info", `Added ${label}`);
    },

    removeSelectedNode: () => {
        const { selectedNodeId, nodes, edges } = get();
        if (!selectedNodeId) return;
        const node = nodes.find((n) => n.id === selectedNodeId);
        get().pushHistory();
        set({
            nodes: nodes.filter((n) => n.id !== selectedNodeId),
            edges: edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
            selectedNodeId: null,
            isDirty: true,
        });
        if (node) get().addLog("warn", `Removed ${node.data.label}`);
    },

    selectNode: (id) => set({ selectedNodeId: id }),

    updateNodeParams: (nodeId, params) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } } : n
            ),
            isDirty: true,
        })),

    updateNodeLabel: (nodeId, label) =>
        set((state) => ({
            nodes: state.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
            ),
            isDirty: true,
        })),

    // ── Connection ─────────────────────
    onConnect: (connection) => {
        const { nodes } = get();
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);
        if (!sourceNode || !targetNode) return false;

        const sourceTemplate = getTemplate(sourceNode.data.componentType);
        const targetTemplate = getTemplate(targetNode.data.componentType);
        if (!sourceTemplate || !targetTemplate) return false;

        // Find ports by handle ID
        const sourcePort = sourceTemplate.ports.find((p) => p.id === connection.sourceHandle);
        const targetPort = targetTemplate.ports.find((p) => p.id === connection.targetHandle);

        if (!sourcePort || !targetPort) {
            get().addLog("error", `Invalid port connection`);
            return false;
        }

        if (sourcePort.direction !== "output" || targetPort.direction !== "input") {
            get().addLog("error", `Cannot connect ${sourcePort.direction} → ${targetPort.direction}`);
            return false;
        }

        if (!areSignalsCompatible(sourcePort.signalType, targetPort.signalType)) {
            get().addLog("error", `Signal mismatch: ${sourcePort.signalType} → ${targetPort.signalType} is incompatible`);
            return false;
        }

        get().pushHistory();
        set((state) => ({
            edges: addEdge(
                {
                    ...connection,
                    animated: true,
                    style: { stroke: "#22d3ee", strokeWidth: 2 },
                    type: "smoothstep",
                },
                state.edges
            ),
            isDirty: true,
        }));
        get().addLog("success", `Connected ${sourceNode.data.label}.${sourcePort.label} → ${targetNode.data.label}.${targetPort.label}`);
        return true;
    },

    // ── Simulation ─────────────────────
    setSimRunning: (running) => set({ simRunning: running }),

    setNodeStatus: (nodeId, status) =>
        set((state) => ({
            nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)),
        })),

    resetAllStatus: () =>
        set((state) => ({
            nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data, status: "idle" as NodeStatus } })),
        })),

    // ── Logs ───────────────────────────
    addLog: (level, message) =>
        set((state) => ({
            logs: [
                ...state.logs.slice(-199),
                { id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), level, message },
            ],
        })),

    clearLogs: () => set({ logs: [] }),

    // ── History ────────────────────────
    pushHistory: () =>
        set((state) => ({
            past: [...state.past.slice(-(MAX_HISTORY - 1)), { nodes: state.nodes, edges: state.edges }],
            future: [],
        })),

    undo: () => {
        const { past, nodes, edges } = get();
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        set({
            past: past.slice(0, -1),
            future: [{ nodes, edges }, ...get().future.slice(0, MAX_HISTORY - 1)],
            nodes: prev.nodes,
            edges: prev.edges,
            isDirty: true,
        });
        get().addLog("info", "Undo");
    },

    redo: () => {
        const { future, nodes, edges } = get();
        if (future.length === 0) return;
        const next = future[0];
        set({
            future: future.slice(1),
            past: [...get().past.slice(-(MAX_HISTORY - 1)), { nodes, edges }],
            nodes: next.nodes,
            edges: next.edges,
            isDirty: true,
        });
        get().addLog("info", "Redo");
    },

    setDirty: (dirty) => set({ isDirty: dirty }),
}));
