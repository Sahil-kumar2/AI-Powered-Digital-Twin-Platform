"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, ShieldCheck, Zap, Filter, Loader2 } from "lucide-react";
import { systems as systemsApi, alerts as alertsApi, getErrorMessage } from "@/lib/api";

interface AlertItem {
    id: string;
    systemId: string;
    ruleId: string | null;
    componentId: string | null;
    severity: string;
    message: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
}

export default function AlertsPage() {
    const [systemsList, setSystemsList] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedSystem, setSelectedSystem] = useState<string>("");
    const [alertsList, setAlertsList] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        systemsApi.list().then((sys) => {
            setSystemsList(sys);
            if (sys.length > 0) setSelectedSystem(sys[0].id);
            setLoading(false);
        }).catch((err) => {
            setError(getErrorMessage(err, "Failed to load systems"));
            setLoading(false);
        });
    }, []);

    const fetchAlerts = useCallback(async () => {
        if (!selectedSystem) return;
        setRefreshing(true);
        setError(null);
        try {
            const data = await alertsApi.list(selectedSystem);
            setAlertsList(data);
        } catch (err) {
            console.error("Failed to fetch alerts", err);
            setError(getErrorMessage(err, "Failed to fetch alerts"));
        } finally {
            setRefreshing(false);
        }
    }, [selectedSystem]);

    // Fetch alerts when system changes
    useEffect(() => {
        void fetchAlerts();
    }, [fetchAlerts]);

    const handleAck = async (id: string) => {
        setActionLoading(id);
        try {
            await alertsApi.acknowledge(id);
            await fetchAlerts();
        } catch (err) {
            console.error("Acknowledge failed", err);
            setError(getErrorMessage(err, "Failed to acknowledge alert"));
        } finally {
            setActionLoading(null);
        }
    };

    const handleResolve = async (id: string) => {
        setActionLoading(id);
        try {
            await alertsApi.resolve(id);
            await fetchAlerts();
        } catch (err) {
            console.error("Resolve failed", err);
            setError(getErrorMessage(err, "Failed to resolve alert"));
        } finally {
            setActionLoading(null);
        }
    };

    const severityStyle = (sev: string) => {
        switch (sev) {
            case "critical": return "bg-rose-500/10 text-rose-500 border-rose-500/20";
            case "high": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case "warning": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            default: return "bg-neutral-800 text-neutral-300 border-neutral-700";
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full text-neutral-500"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...</div>;
    }

    return (
        <div className="flex flex-col h-full gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Operations Alerts</h1>
                    <p className="text-neutral-400 text-sm mt-1">Real-time system event notifications.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <select
                        value={selectedSystem}
                        onChange={(e) => setSelectedSystem(e.target.value)}
                        className="flex-1 sm:flex-none bg-neutral-900 border border-neutral-800 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                    >
                        {systemsList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <button onClick={fetchAlerts} className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-md text-sm font-medium flex items-center justify-center gap-2 text-neutral-300 hover:text-white transition-colors">
                        {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />} Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
                    {error}
                </div>
            )}

            {alertsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-500 gap-3">
                    <ShieldCheck className="h-12 w-12 text-neutral-700" />
                    <p>No alerts for this system.</p>
                    <p className="text-xs text-neutral-600">Alerts are generated when telemetry exceeds configured alert rules during simulation.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                    {alertsList.map((a) => (
                        <div key={a.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${severityStyle(a.severity)}`}>
                                        {a.severity === "critical" ? <Zap className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                        {a.severity}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${a.status === "active" ? "bg-rose-500/10 text-rose-400" :
                                            a.status === "acknowledged" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                                        }`}>
                                        {a.status}
                                    </span>
                                </div>
                                <span className="text-xs text-neutral-500">{new Date(a.createdAt).toLocaleString()}</span>
                            </div>
                            <p className={`text-sm ${a.status === "resolved" ? "text-neutral-500" : "text-neutral-200"}`}>{a.message}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-neutral-500">{a.componentId ? `Component: ${a.componentId.slice(0, 8)}...` : ""}</span>
                                <div className="flex gap-2">
                                    {a.status === "active" && (
                                        <button
                                            onClick={() => handleAck(a.id)}
                                            disabled={actionLoading === a.id}
                                            className="text-xs font-medium px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors border border-neutral-700 disabled:opacity-50"
                                        >
                                            {actionLoading === a.id ? "..." : "Acknowledge"}
                                        </button>
                                    )}
                                    {(a.status === "active" || a.status === "acknowledged") && (
                                        <button
                                            onClick={() => handleResolve(a.id)}
                                            disabled={actionLoading === a.id}
                                            className="text-xs font-medium px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors border border-emerald-500/30 disabled:opacity-50"
                                        >
                                            {actionLoading === a.id ? "..." : "Resolve"}
                                        </button>
                                    )}
                                    {a.status === "resolved" && (
                                        <span className="text-xs font-medium text-emerald-500 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Resolved</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
