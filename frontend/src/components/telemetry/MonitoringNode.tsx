"use client";
import React, { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { getTemplate, CATEGORY_COLORS } from "@/lib/componentLibrary";

// ─── Types ──────────────────────────────────────
export type HealthStatus = "healthy" | "warning" | "failure" | "idle";

export interface MonitoringNodeData {
    componentType: string;
    label: string;
    status: HealthStatus;
    liveValue: string | null;       // e.g. "28.4°C"
    liveMetric: string | null;      // e.g. "temperature"
    sparkline: number[];            // last 20 values
    alertCount: number;
}

const STATUS_CONFIG: Record<HealthStatus, { color: string; glow: string; label: string }> = {
    healthy: { color: "#22c55e", glow: "0 0 12px #22c55e60", label: "Healthy" },
    warning: { color: "#eab308", glow: "0 0 12px #eab30860", label: "Warning" },
    failure: { color: "#ef4444", glow: "0 0 16px #ef444480", label: "Fault" },
    idle: { color: "#525252", glow: "none", label: "Idle" },
};

// ─── Inline Sparkline SVG ───────────────────────
function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
    if (data.length < 2) return <div style={{ width, height }} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(" ");

    return (
        <svg width={width} height={height} className="opacity-60">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

// ─── Monitoring Node ────────────────────────────
function MonitoringNode({ data, selected }: NodeProps<MonitoringNodeData>) {
    const template = useMemo(() => getTemplate(data.componentType), [data.componentType]);
    if (!template) return null;

    const catColor = CATEGORY_COLORS[template.category] || "#525252";
    const statusCfg = STATUS_CONFIG[data.status];
    const IconComp = template.icon;

    const inputPorts = template.ports.filter((p) => p.direction === "input");
    const outputPorts = template.ports.filter((p) => p.direction === "output");

    return (
        <div className="relative" style={{ minWidth: 190 }}>
            {/* Health glow ring */}
            <div
                className="absolute -inset-[2px] rounded-xl pointer-events-none transition-all duration-500"
                style={{
                    border: `2px solid ${statusCfg.color}`,
                    boxShadow: statusCfg.glow,
                    opacity: data.status === "idle" ? 0.3 : 1,
                }}
            />

            {/* Alert badge */}
            {data.alertCount > 0 && (
                <div className="absolute -top-2 -right-2 z-10 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse shadow-lg shadow-red-500/50">
                    {data.alertCount}
                </div>
            )}

            <div
                className="rounded-xl overflow-hidden"
                style={{
                    background: "#0a0a0a",
                    border: `1px solid ${selected ? catColor : "#1a1a1a"}`,
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ background: `${catColor}10`, borderBottom: `1px solid ${catColor}20` }}
                >
                    <IconComp className="h-3.5 w-3.5 shrink-0" style={{ color: catColor }} />
                    <span className="text-[11px] font-semibold text-neutral-200 truncate flex-1">{data.label}</span>
                    <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 transition-colors duration-500"
                        style={{
                            backgroundColor: statusCfg.color,
                            boxShadow: data.status !== "idle" ? `0 0 8px ${statusCfg.color}` : "none",
                        }}
                    />
                </div>

                {/* Live telemetry value + sparkline */}
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        {data.liveValue ? (
                            <div className="text-lg font-bold text-white tracking-tight leading-tight">
                                {data.liveValue}
                            </div>
                        ) : (
                            <div className="text-xs text-neutral-600">No data</div>
                        )}
                        <div className="text-[9px] text-neutral-500 mt-0.5 uppercase tracking-wider">
                            {data.liveMetric || template.category}
                        </div>
                    </div>
                    {data.sparkline.length > 1 && (
                        <Sparkline data={data.sparkline} color={statusCfg.color} />
                    )}
                </div>

                {/* Status bar */}
                <div
                    className="px-3 py-1 flex items-center justify-between border-t"
                    style={{ borderColor: `${catColor}15` }}
                >
                    <span className="text-[8px] uppercase tracking-wider font-medium" style={{ color: `${catColor}60` }}>
                        {template.category}
                    </span>
                    <span className="text-[9px] font-medium" style={{ color: statusCfg.color }}>
                        {statusCfg.label}
                    </span>
                </div>
            </div>

            {/* Port handles (invisible but functional for edges) */}
            {inputPorts.map((port, i) => (
                <Handle
                    key={port.id}
                    type="target"
                    position={Position.Left}
                    id={port.id}
                    style={{
                        top: `${30 + ((i + 1) / (inputPorts.length + 1)) * 70}%`,
                        width: 8,
                        height: 8,
                        border: `2px solid ${catColor}40`,
                        background: "#0a0a0a",
                        opacity: 0.5,
                    }}
                    className="!rounded-full"
                />
            ))}
            {outputPorts.map((port, i) => (
                <Handle
                    key={port.id}
                    type="source"
                    position={Position.Right}
                    id={port.id}
                    style={{
                        top: `${30 + ((i + 1) / (outputPorts.length + 1)) * 70}%`,
                        width: 8,
                        height: 8,
                        border: `2px solid ${catColor}40`,
                        background: "#0a0a0a",
                        opacity: 0.5,
                    }}
                    className="!rounded-full"
                />
            ))}
        </div>
    );
}

export default memo(MonitoringNode);
