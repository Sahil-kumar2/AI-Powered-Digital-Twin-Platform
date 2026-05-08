"use client";
import React from "react";
import { useBuilderStore } from "@/lib/builderStore";
import { getTemplate } from "@/lib/componentLibrary";
import { X, Trash2, Zap, Plug } from "lucide-react";

export default function PropertiesPanel() {
    const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
    const nodes = useBuilderStore((s) => s.nodes);
    const updateNodeParams = useBuilderStore((s) => s.updateNodeParams);
    const updateNodeLabel = useBuilderStore((s) => s.updateNodeLabel);
    const removeSelectedNode = useBuilderStore((s) => s.removeSelectedNode);
    const selectNode = useBuilderStore((s) => s.selectNode);

    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 gap-3">
                <Plug className="h-8 w-8 text-neutral-700" />
                <p className="text-sm text-center">Select a component to view its properties</p>
            </div>
        );
    }

    const template = getTemplate(node.data.componentType);
    if (!template) return null;

    const IconComp = template.icon;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/50 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <IconComp className="h-4 w-4 shrink-0" style={{ color: template.color }} />
                    <span className="text-sm font-bold text-neutral-100 truncate">{node.data.label}</span>
                </div>
                <button onClick={() => selectNode(null)} className="p-1 text-neutral-500 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Component Info */}
                <div>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Component</span>
                    <p className="text-xs text-neutral-400 mt-1">{template.description}</p>
                    <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${template.color}15`, color: template.color, border: `1px solid ${template.color}30` }}>
                        {template.category}
                    </span>
                </div>

                {/* Name */}
                <div>
                    <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-1.5">Display Name</label>
                    <input
                        type="text"
                        value={node.data.label}
                        onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-white transition-colors"
                    />
                </div>

                {/* Parameters */}
                {template.params.length > 0 && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-2">Parameters</span>
                        <div className="space-y-3">
                            {template.params.map((param) => (
                                <div key={param.key}>
                                    <label className="text-xs text-neutral-300 mb-1 flex items-center justify-between">
                                        <span>{param.label}</span>
                                        {param.unit && <span className="text-neutral-600 text-[10px]">{param.unit}</span>}
                                    </label>
                                    {param.type === "select" ? (
                                        <select
                                            value={node.data.params[param.key] ?? param.defaultValue}
                                            onChange={(e) => updateNodeParams(node.id, { [param.key]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) })}
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 text-white"
                                        >
                                            {param.options?.map((o) => (
                                                <option key={String(o.value)} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    ) : param.type === "range" ? (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={param.min ?? 0}
                                                max={param.max ?? 1}
                                                step={param.step ?? 0.01}
                                                value={node.data.params[param.key] ?? param.defaultValue}
                                                onChange={(e) => updateNodeParams(node.id, { [param.key]: Number(e.target.value) })}
                                                className="flex-1 accent-cyan-500"
                                            />
                                            <span className="text-xs text-neutral-400 w-12 text-right font-mono">
                                                {Number(node.data.params[param.key] ?? param.defaultValue).toFixed(2)}
                                            </span>
                                        </div>
                                    ) : param.type === "number" ? (
                                        <input
                                            type="number"
                                            value={node.data.params[param.key] ?? param.defaultValue}
                                            min={param.min}
                                            max={param.max}
                                            step={param.step ?? 1}
                                            onChange={(e) => updateNodeParams(node.id, { [param.key]: Number(e.target.value) })}
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 text-white"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={node.data.params[param.key] ?? param.defaultValue}
                                            onChange={(e) => updateNodeParams(node.id, { [param.key]: e.target.value })}
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500 text-white"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Ports Info */}
                <div>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-2">Ports</span>
                    <div className="space-y-1">
                        {template.ports.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs px-2 py-1 bg-neutral-950 rounded">
                                <div className="flex items-center gap-2">
                                    <span className={`h-1.5 w-1.5 rounded-full ${p.direction === "input" ? "bg-blue-500" : "bg-emerald-500"}`}></span>
                                    <span className="text-neutral-300">{p.label}</span>
                                </div>
                                <span className="text-neutral-600 text-[10px] font-mono">{p.signalType}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Power */}
                {template.power && (
                    <div>
                        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold block mb-2">
                            <Zap className="h-3 w-3 inline mr-1 text-amber-500" />Power Requirements
                        </span>
                        <div className="flex gap-4 text-xs">
                            <div className="px-3 py-2 bg-neutral-950 rounded-lg flex-1">
                                <span className="text-neutral-500 block text-[10px]">Voltage</span>
                                <span className="text-amber-400 font-semibold">{template.power.voltage}V</span>
                            </div>
                            <div className="px-3 py-2 bg-neutral-950 rounded-lg flex-1">
                                <span className="text-neutral-500 block text-[10px]">Current</span>
                                <span className="text-amber-400 font-semibold">{(template.power.current * 1000).toFixed(0)}mA</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete */}
            <div className="p-4 border-t border-neutral-800 shrink-0">
                <button
                    onClick={removeSelectedNode}
                    className="w-full px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                    <Trash2 className="h-4 w-4" /> Remove Component
                </button>
            </div>
        </div>
    );
}
