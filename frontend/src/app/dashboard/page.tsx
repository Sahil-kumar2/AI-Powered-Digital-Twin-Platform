"use client";
import React, { useEffect, useState } from "react";
import { Activity, BellRing, Cpu, Database, Server, Zap } from "lucide-react";
import { systems as systemsApi, alerts as alertsApi, auth, getErrorMessage } from "@/lib/api";
import Link from "next/link";

export default function DashboardOverview() {
    const [systemsList, setSystemsList] = useState<any[]>([]);
    const [alertCount, setAlertCount] = useState(0);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const sys = await systemsApi.list();
            setSystemsList(sys);
            // Count active alerts across all systems
            let totalAlerts = 0;
            for (const s of sys.slice(0, 5)) {
                try {
                    const a = await alertsApi.list(s.id, "active");
                    totalAlerts += a.length;
                } catch {
                    // Keep partial counts to avoid blocking the dashboard.
                }
            }
            setAlertCount(totalAlerts);
        } catch (err) {
            console.error("Dashboard load failed", err);
            setError(getErrorMessage(err, "Failed to load dashboard data"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const u = auth.getUser();
        setUser(u);

        void load();
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    {user ? `Welcome back, ${user.name || user.email}` : "System Overview"}
                </h1>
                <p className="text-neutral-400 text-sm mt-1">Monitor the health and telemetry of all your digital twins.</p>
            </div>

            {error && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
                    <span>{error}</span>
                    <button onClick={() => void load()} className="rounded-md border border-rose-700/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/30">
                        Retry
                    </button>
                </div>
            )}

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Active Systems", value: loading ? "..." : String(systemsList.length), icon: Server, color: "text-blue-400" },
                    { label: "Active Alerts", value: loading ? "..." : String(alertCount), icon: BellRing, color: "text-rose-500" },
                    { label: "AI Anomaly Rate", value: "1.2%", icon: Activity, color: "text-amber-400" },
                    { label: "Global Throughput", value: "482 req/s", icon: Database, color: "text-emerald-400" },
                ].map((kpi, i) => (
                    <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between h-32 hover:border-neutral-700 transition-colors">
                        <div className="flex justify-between items-start">
                            <span className="text-sm font-medium text-neutral-400">{kpi.label}</span>
                            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                        </div>
                        <span className="text-3xl font-bold tracking-tight">{kpi.value}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Systems Grid */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <h2 className="text-lg font-semibold border-b border-neutral-800 pb-2">Your Systems</h2>
                    {loading ? (
                        <p className="text-neutral-500 text-sm py-4">Loading...</p>
                    ) : systemsList.length === 0 ? (
                        <div className="text-neutral-500 text-sm py-8 text-center">
                            No systems yet. <Link href="/dashboard/systems" className="text-cyan-400 hover:underline">Create one</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {systemsList.slice(0, 4).map((sys) => (
                                <Link href={`/dashboard/systems/${sys.id}/builder`} key={sys.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-neutral-950 rounded-lg group-hover:bg-cyan-950/30 transition-colors">
                                                <Cpu className="h-5 w-5 text-cyan-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-neutral-100">{sys.name}</h3>
                                                <p className="text-xs text-neutral-500">{sys.description || "No description"}</p>
                                            </div>
                                        </div>
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Active
                                        </span>
                                    </div>
                                    <div className="h-12 w-full flex items-end gap-1 opacity-50 relative mt-2">
                                        {Array.from({ length: 20 }).map((_, i) => (
                                            <div key={i} className="w-full bg-cyan-800 rounded-t-sm" style={{ height: `${40 + Math.sin(i * 0.5) * 30 + 20}%` }}></div>
                                        ))}
                                        <div className="absolute bottom-0 left-0 w-full h-px bg-neutral-800"></div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Activity Feed — placeholder for now */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold border-b border-neutral-800 pb-2">Live Activity</h2>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-0 overflow-hidden flex flex-col">
                        <div className="flex flex-col divide-y divide-neutral-800/60 h-[400px] overflow-y-auto">
                            {[
                                { time: "Just now", text: "Dashboard loaded", type: "info" },
                                { time: "—", text: "Waiting for simulation events...", type: "info" },
                            ].map((log, i) => (
                                <div key={i} className="p-4 flex gap-3 items-start hover:bg-neutral-800/30">
                                    <div className="mt-0.5">
                                        <Server className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-neutral-200">{log.text}</span>
                                        <span className="text-xs text-neutral-500">{log.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
