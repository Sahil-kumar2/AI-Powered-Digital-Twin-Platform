"use client";
import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { X, Zap, Activity, AlertTriangle, Link2 } from "lucide-react";
import { getTemplate, CATEGORY_COLORS } from "@/lib/componentLibrary";
import type { HealthStatus } from "./MonitoringNode";

interface TelemetryDetailPanelProps {
    nodeId: string;
    label: string;
    componentType: string;
    status: HealthStatus;
    liveValue: string | null;
    sparkline: number[];
    connections: { label: string; direction: "in" | "out" }[];
    alertCount: number;
    onClose: () => void;
}

const STATUS_COLORS: Record<HealthStatus, string> = {
    healthy: "#22c55e", warning: "#eab308", failure: "#ef4444", idle: "#525252",
};

export default function TelemetryDetailPanel({
    nodeId, label, componentType, status, liveValue, sparkline, connections, alertCount, onClose,
}: TelemetryDetailPanelProps) {
    const template = getTemplate(componentType);
    const catColor = template ? CATEGORY_COLORS[template.category] || "#525252" : "#525252";
    const IconComp = template?.icon || Activity;

    // Build chart data from sparkline
    const chartData = sparkline.map((v, i) => ({ idx: i, value: Number(v.toFixed(2)) }));

    return (
        <div className="flex flex-col h-full overflow-hidden bg-neutral-950">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0" style={{ background: `${catColor}08` }}>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg" style={{ background: `${catColor}15` }}>
                        <IconComp className="h-4 w-4" style={{ color: catColor }} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{label}</h3>
                        <span className="text-[10px] text-neutral-500">{template?.description || componentType}</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Status + Live Value */}
                <div className="flex gap-3">
                    <div className="flex-1 bg-neutral-900 rounded-xl p-3 border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">Status</span>
                        <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status], boxShadow: `0 0 8px ${STATUS_COLORS[status]}` }} />
                            <span className="text-sm font-semibold capitalize" style={{ color: STATUS_COLORS[status] }}>{status}</span>
                        </div>
                    </div>
                    <div className="flex-1 bg-neutral-900 rounded-xl p-3 border border-neutral-800">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">Live Value</span>
                        <span className="text-lg font-bold text-white">{liveValue || "—"}</span>
                    </div>
                </div>

                {/* Telemetry Chart */}
                {chartData.length > 1 && (
                    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="h-3.5 w-3.5 text-cyan-400" />
                            <span className="text-xs font-semibold text-neutral-300">Telemetry Timeline</span>
                            <span className="text-[10px] text-neutral-600 ml-auto">{chartData.length} samples</span>
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                                <XAxis dataKey="idx" hide />
                                <YAxis stroke="#333" tick={{ fontSize: 9, fill: "#666" }} width={35} domain={["auto", "auto"]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }}
                                    labelFormatter={() => ""}
                                />
                                <Line type="monotone" dataKey="value" stroke={STATUS_COLORS[status]} strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Component Info */}
                {template && (
                    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 space-y-2">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Component Info</span>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Type</span>
                                <span className="text-neutral-300 font-medium">{template.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Category</span>
                                <span className="font-medium" style={{ color: catColor }}>{template.category}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Ports</span>
                                <span className="text-neutral-300">{template.ports.length} ({template.ports.filter(p => p.direction === "input").length} in, {template.ports.filter(p => p.direction === "output").length} out)</span>
                            </div>
                            {template.power && (
                                <div className="flex justify-between">
                                    <span className="text-neutral-500 flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> Power</span>
                                    <span className="text-amber-400 font-medium">{template.power.voltage}V / {(template.power.current * 1000).toFixed(0)}mA</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Connections */}
                {connections.length > 0 && (
                    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Link2 className="h-3.5 w-3.5 text-cyan-400" />
                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Connections</span>
                        </div>
                        <div className="space-y-1">
                            {connections.map((c, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 bg-neutral-950 rounded">
                                    <span className={`h-1.5 w-1.5 rounded-full ${c.direction === "in" ? "bg-blue-500" : "bg-emerald-500"}`} />
                                    <span className="text-neutral-400">{c.direction === "in" ? "←" : "→"}</span>
                                    <span className="text-neutral-300">{c.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Alerts */}
                {alertCount > 0 && (
                    <div className="bg-rose-500/5 rounded-xl p-4 border border-rose-500/20">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-400" />
                            <span className="text-sm font-semibold text-rose-400">{alertCount} Active Alert{alertCount > 1 ? "s" : ""}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
