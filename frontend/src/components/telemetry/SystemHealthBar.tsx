"use client";
import React from "react";
import { Heart, AlertTriangle, CheckCircle, Activity, Gauge } from "lucide-react";
import type { HealthStatus } from "./MonitoringNode";

interface NodeStat {
    total: number;
    healthy: number;
    warning: number;
    failure: number;
    idle: number;
}

interface SystemHealthBarProps {
    systemName: string;
    stats: NodeStat;
    alertCount: number;
    eventsPerSec: number;
    connected: boolean;
}

export default function SystemHealthBar({ systemName, stats, alertCount, eventsPerSec, connected }: SystemHealthBarProps) {
    // Health score = 100 - (warnings * 5 + failures * 20)
    const healthScore = Math.max(0, Math.min(100, 100 - (stats.warning * 5 + stats.failure * 20)));
    const scoreColor = healthScore >= 80 ? "#22c55e" : healthScore >= 50 ? "#eab308" : "#ef4444";

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-950 border-t border-neutral-800 text-xs gap-4 overflow-x-auto shrink-0">
            {/* Health Score */}
            <div className="flex items-center gap-2 shrink-0">
                <Heart className="h-3.5 w-3.5" style={{ color: scoreColor }} />
                <span className="text-neutral-500">Health:</span>
                <span className="font-bold text-sm" style={{ color: scoreColor }}>{healthScore}%</span>
            </div>

            {/* Node Counts */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-neutral-400">{stats.healthy}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-neutral-400">{stats.warning}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-neutral-400">{stats.failure}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-neutral-600" />
                    <span className="text-neutral-400">{stats.idle}</span>
                </div>
                <span className="text-neutral-600">|</span>
                <span className="text-neutral-500">{stats.total} nodes</span>
            </div>

            {/* Alerts */}
            <div className="flex items-center gap-1.5 shrink-0">
                {alertCount > 0 ? (
                    <>
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                        <span className="text-rose-400 font-semibold">{alertCount} alert{alertCount > 1 ? "s" : ""}</span>
                    </>
                ) : (
                    <>
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">No alerts</span>
                    </>
                )}
            </div>

            {/* Throughput */}
            <div className="flex items-center gap-1.5 shrink-0">
                <Gauge className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-neutral-500">Throughput:</span>
                <span className="text-cyan-400 font-semibold">{eventsPerSec.toFixed(1)}</span>
                <span className="text-neutral-600">evt/s</span>
            </div>

            {/* Connection */}
            <div className="flex items-center gap-1.5 shrink-0">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className={connected ? "text-emerald-400" : "text-rose-400"}>{connected ? "Live" : "Offline"}</span>
            </div>
        </div>
    );
}
