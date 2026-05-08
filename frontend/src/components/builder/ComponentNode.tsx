"use client";
import React, { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { getTemplate, CATEGORY_COLORS, type PortDef } from "@/lib/componentLibrary";
import type { BuilderNodeData, NodeStatus } from "@/lib/builderStore";

const STATUS_COLORS: Record<NodeStatus, string> = {
    idle: "#525252",
    healthy: "#22c55e",
    warning: "#eab308",
    failure: "#ef4444",
};

const STATUS_LABELS: Record<NodeStatus, string> = {
    idle: "",
    healthy: "Online",
    warning: "Warning",
    failure: "Fault",
};

const SIGNAL_COLORS: Record<string, string> = {
    power_dc: "#f59e0b",
    power_ac: "#f59e0b",
    temperature: "#f97316",
    humidity: "#3b82f6",
    voltage: "#eab308",
    pressure: "#a855f7",
    analog: "#22d3ee",
    digital: "#10b981",
    pwm: "#8b5cf6",
    serial: "#ec4899",
    spi: "#ec4899",
    i2c: "#ec4899",
    data_stream: "#06b6d4",
    control_signal: "#10b981",
    wifi_data: "#06b6d4",
    bluetooth_data: "#3b82f6",
    rf_wireless: "#f43f5e",
    current: "#eab308",
};

function ComponentNode({ data, selected }: NodeProps<BuilderNodeData>) {
    const template = useMemo(() => getTemplate(data.componentType), [data.componentType]);
    if (!template) return null;

    const catColor = CATEGORY_COLORS[template.category] || "#525252";
    const inputPorts = template.ports.filter((p) => p.direction === "input");
    const outputPorts = template.ports.filter((p) => p.direction === "output");
    const maxPorts = Math.max(inputPorts.length, outputPorts.length, 1);

    const IconComp = template.icon;

    return (
        <div className="relative group" style={{ minWidth: 200 }}>
            {/* Selection ring */}
            {selected && (
                <div
                    className="absolute -inset-[3px] rounded-xl pointer-events-none"
                    style={{
                        border: `2px solid ${catColor}`,
                        boxShadow: `0 0 12px ${catColor}40`,
                    }}
                />
            )}

            {/* Main card */}
            <div
                className="rounded-xl overflow-hidden transition-shadow"
                style={{
                    background: "#0a0a0a",
                    border: `1px solid ${selected ? catColor : "#2a2a2a"}`,
                    boxShadow: selected ? `0 0 20px ${catColor}15` : "0 2px 8px rgba(0,0,0,0.3)",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ background: `${catColor}15`, borderBottom: `1px solid ${catColor}30` }}
                >
                    <IconComp className="h-3.5 w-3.5 shrink-0" style={{ color: catColor }} />
                    <span className="text-xs font-semibold text-neutral-100 truncate flex-1">{data.label}</span>
                    {data.status !== "idle" && (
                        <span className="flex items-center gap-1 shrink-0">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor: STATUS_COLORS[data.status],
                                    boxShadow: `0 0 6px ${STATUS_COLORS[data.status]}`,
                                }}
                            />
                            <span className="text-[9px] font-medium" style={{ color: STATUS_COLORS[data.status] }}>
                                {STATUS_LABELS[data.status]}
                            </span>
                        </span>
                    )}
                </div>

                {/* Ports — each row is one port pair (left input, right output) */}
                <div className="px-0 py-2 relative">
                    {Array.from({ length: maxPorts }).map((_, i) => {
                        const inp = inputPorts[i];
                        const out = outputPorts[i];
                        return (
                            <div key={i} className="flex items-center justify-between h-7 relative">
                                {/* Input port + label */}
                                <div className="flex items-center gap-0 pl-4 min-w-0 flex-1">
                                    {inp && (
                                        <>
                                            <Handle
                                                type="target"
                                                position={Position.Left}
                                                id={inp.id}
                                                style={{
                                                    top: "auto",
                                                    position: "absolute",
                                                    left: -5,
                                                    width: 10,
                                                    height: 10,
                                                    border: `2px solid ${SIGNAL_COLORS[inp.signalType] || "#525252"}`,
                                                    background: "#0a0a0a",
                                                }}
                                                className="!rounded-full hover:!scale-150 !transform-none"
                                            />
                                            <span className="text-[10px] text-neutral-400 truncate">{inp.label}</span>
                                        </>
                                    )}
                                </div>

                                {/* Output port + label */}
                                <div className="flex items-center gap-0 pr-4 min-w-0 flex-1 justify-end">
                                    {out && (
                                        <>
                                            <span className="text-[10px] text-neutral-400 truncate">{out.label}</span>
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                id={out.id}
                                                style={{
                                                    top: "auto",
                                                    position: "absolute",
                                                    right: -5,
                                                    width: 10,
                                                    height: 10,
                                                    border: `2px solid ${SIGNAL_COLORS[out.signalType] || "#525252"}`,
                                                    background: "#0a0a0a",
                                                }}
                                                className="!rounded-full hover:!scale-150 !transform-none"
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Category footer */}
                <div className="px-3 py-1 border-t border-neutral-800/50">
                    <span className="text-[8px] uppercase tracking-wider font-medium" style={{ color: `${catColor}80` }}>
                        {template.category}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default memo(ComponentNode);
