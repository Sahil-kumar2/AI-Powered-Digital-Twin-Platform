"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle, SearchCode, LineChart, FileTerminal, Loader2, FlaskConical } from "lucide-react";
import { ai, simulation, systems, getErrorMessage } from "@/lib/api";

type MetricRow = {
    metric: string;
    latest: number;
    zScore: number;
    anomalyScore: number;
    flagged: boolean;
};

type SystemSummary = {
    id: string;
    name: string;
};

type ScenarioSuggestion = {
    type: string;
    targetComponentId: string;
    severity: number;
    durationTicks: number;
    rationale: string;
};

export default function InsightsPage() {
    const [systemsList, setSystemsList] = useState<SystemSummary[]>([]);
    const [selectedSystemId, setSelectedSystemId] = useState("");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [anomaly, setAnomaly] = useState<{ metricStats: MetricRow[]; isAnomalous: boolean; flaggedCount: number } | null>(null);
    const [failure, setFailure] = useState<{ failureProbability: number; riskLevel: string; horizonMinutes: number; factors: Array<{ metric: string; impact: number; latest: number }> } | null>(null);
    const [analysis, setAnalysis] = useState("");
    const [suggestions, setSuggestions] = useState<ScenarioSuggestion[]>([]);
    const [injecting, setInjecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [aiFallbackNotice, setAiFallbackNotice] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const sys = await systems.list();
                setSystemsList(sys);
                if (sys.length > 0) setSelectedSystemId(sys[0].id);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to load systems";
                setError(message);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const runAnalysis = React.useCallback(async () => {
        if (!selectedSystemId) return;
        setRefreshing(true);
        setError(null);
        setAiFallbackNotice(null);
        try {
            const [a, f, s] = await Promise.all([
                ai.anomaly(selectedSystemId),
                ai.failure(selectedSystemId),
                ai.suggestScenarios(selectedSystemId),
            ]);

            setAnomaly(a);
            setFailure(f);
            setSuggestions(s.suggestions || []);

            if (a?.fallback || f?.fallback || s?.fallback) {
                setAiFallbackNotice("AI service is currently unavailable. Showing fallback values from platform defaults.");
            }

            const summary = await ai.ask(
                "Provide a concise root-cause analysis and actionable remediation steps for the latest anomaly and failure risk.",
                { systemId: selectedSystemId, namespace: `system-${selectedSystemId}`, topK: 4 }
            );
            setAnalysis(summary.answer || "No analysis available.");
            if (summary?.fallback) {
                setAiFallbackNotice("AI service is currently unavailable. Root-cause narrative is using fallback guidance.");
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Analysis failed"));
        } finally {
            setRefreshing(false);
        }
    }, [selectedSystemId]);

    useEffect(() => {
        if (selectedSystemId) {
            void runAnalysis();
        }
    }, [selectedSystemId, runAnalysis]);

    const topAnomalies = useMemo(() => {
        if (!anomaly?.metricStats) return [];
        return anomaly.metricStats.slice(0, 8);
    }, [anomaly]);

    const systemName = useMemo(() => {
        return systemsList.find((s) => s.id === selectedSystemId)?.name || "Unknown System";
    }, [systemsList, selectedSystemId]);

    const actionChecklist = useMemo(() => {
        const items: string[] = [];
        const risk = failure?.failureProbability || 0;
        const flagged = anomaly?.flaggedCount || 0;

        if (risk >= 0.85) {
            items.push("Escalate to critical incident response and isolate affected components immediately.");
        } else if (risk >= 0.65) {
            items.push("Schedule maintenance within the next shift and reduce operational load now.");
        }

        if (flagged > 0) {
            items.push(`Investigate ${flagged} flagged telemetry metrics and validate sensor calibration.`);
        }

        if ((suggestions || []).length > 0) {
            items.push("Use scenario injections to reproduce failure paths before deploying remediation.");
        }

        if (items.length === 0) {
            items.push("System appears stable. Continue monitoring and refresh analysis after major events.");
        }

        return items;
    }, [failure?.failureProbability, anomaly?.flaggedCount, suggestions]);

    const injectSuggestion = async (s: { type: string; targetComponentId: string; severity: number; durationTicks: number }) => {
        if (!selectedSystemId) return;
        setInjecting(`${s.type}:${s.targetComponentId}`);
        try {
            await simulation.injectScenario(selectedSystemId, {
                type: s.type,
                targetComponentId: s.targetComponentId,
                severity: s.severity,
                durationTicks: s.durationTicks,
            });
            await runAnalysis();
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to inject scenario"));
        } finally {
            setInjecting(null);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading insights...
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6 h-full pb-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">AI Insights & Analytics</h1>
                <p className="text-neutral-400 text-sm mt-1">ML anomaly detection and predictive maintenance reports.</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedSystemId}
                        onChange={(e) => setSelectedSystemId(e.target.value)}
                        className="bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 text-sm"
                    >
                        {systemsList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => void runAnalysis()}
                        disabled={refreshing || !selectedSystemId}
                        className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-neutral-950 text-sm font-semibold rounded-md"
                    >
                        {refreshing ? "Analyzing..." : "Refresh"}
                    </button>
                </div>
            </div>

            {error && <div className="text-sm text-rose-400 border border-rose-900/50 bg-rose-950/20 rounded-lg p-3">{error}</div>}
            {aiFallbackNotice && <div className="text-sm text-amber-300 border border-amber-900/50 bg-amber-950/20 rounded-lg p-3">{aiFallbackNotice}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                {/* Left Column: Anomaly List */}
                <div className="lg:col-span-1 border border-neutral-800 bg-neutral-900 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-neutral-800 bg-neutral-900/50">
                        <h2 className="font-semibold flex items-center gap-2"><SearchCode className="h-4 w-4 text-cyan-400" /> Recent Anomalies</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/50">
                        {topAnomalies.length === 0 && (
                            <div className="p-4 text-sm text-neutral-500">No anomaly data yet. Start a simulation and refresh.</div>
                        )}
                        {topAnomalies.map((a, idx) => (
                            <div key={`${a.metric}-${idx}`} className="p-4 hover:bg-neutral-800/30 transition-colors border-l-2 border-transparent hover:border-cyan-500">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold text-neutral-200">{a.metric}</span>
                                    <span className="text-xs text-neutral-500">z={a.zScore.toFixed(2)}</span>
                                </div>
                                <div className="text-sm text-neutral-300 mb-1">{systemName}</div>
                                <div className="text-xs text-neutral-500 flex justify-between items-center">
                                    <span>Latest: {a.latest.toFixed(2)}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.flagged ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                        Score: {Math.round(a.anomalyScore * 100)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Deep Dive */}
                <div className="lg:col-span-2 border border-neutral-800 bg-neutral-900 rounded-xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-y-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 border-b border-neutral-800 pb-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                                <h2 className="text-xl font-bold">Live AI Diagnostic</h2>
                                <span className={`px-2 py-0.5 border rounded-full text-xs font-semibold ${failure?.riskLevel === 'critical' || failure?.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                    {failure ? `${failure.riskLevel.toUpperCase()} Risk` : "No Risk Data"}
                                </span>
                            </div>
                            <p className="text-sm text-neutral-400">{systemName}</p>
                        </div>
                        <button onClick={() => void runAnalysis()} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-md transition-colors">
                            Recompute
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col justify-between">
                            <span className="text-sm text-neutral-400 font-medium flex items-center gap-2"><LineChart className="h-4 w-4" /> Failure Probability</span>
                            <div className="mt-4 flex items-end gap-2">
                                <span className={`text-4xl font-black ${failure && failure.failureProbability >= 0.7 ? 'text-rose-500' : 'text-emerald-400'}`}>
                                    {failure ? Math.round(failure.failureProbability * 100) : 0}
                                    <span className="text-lg text-neutral-500">%</span>
                                </span>
                            </div>
                            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className={`h-full ${failure && failure.failureProbability >= 0.7 ? 'bg-rose-500' : 'bg-emerald-400'}`} style={{ width: `${Math.round((failure?.failureProbability || 0) * 100)}%` }}></div>
                            </div>
                            <p className="text-xs text-neutral-500 mt-2">Predicted risk window: {failure?.horizonMinutes || 0} minutes.</p>
                        </div>

                        <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg">
                            <span className="text-sm text-neutral-400 font-medium flex items-center gap-2 mb-3"><BrainCircuit className="h-4 w-4" /> Risk Drivers</span>
                            <div className="space-y-3">
                                {(failure?.factors || []).slice(0, 3).map((f) => (
                                    <div key={f.metric} className="flex justify-between items-center text-sm">
                                        <span className="text-neutral-300">{f.metric}</span>
                                        <span className="text-cyan-400">Impact {Math.round(f.impact * 100)}%</span>
                                    </div>
                                ))}
                                {(failure?.factors || []).length === 0 && <div className="text-xs text-neutral-500">No factors available yet.</div>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 border border-neutral-800 rounded-lg bg-neutral-950/80">
                            <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Flagged Metrics</div>
                            <div className="text-2xl font-bold text-amber-300 mt-1">{anomaly?.flaggedCount || 0}</div>
                        </div>
                        <div className="p-3 border border-neutral-800 rounded-lg bg-neutral-950/80">
                            <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Suggested Scenarios</div>
                            <div className="text-2xl font-bold text-cyan-300 mt-1">{suggestions.length}</div>
                        </div>
                        <div className="p-3 border border-neutral-800 rounded-lg bg-neutral-950/80">
                            <div className="text-[11px] text-neutral-500 uppercase tracking-wide">Risk Horizon</div>
                            <div className="text-2xl font-bold text-neutral-100 mt-1">{failure?.horizonMinutes || 0}m</div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-neutral-300 mb-3 flex items-center gap-2 uppercase tracking-wide"><FileTerminal className="h-4 w-4 text-cyan-400" /> AI Root Cause Analysis</h3>
                        <div className="p-4 bg-cyan-950/20 border border-cyan-900/30 rounded-lg text-sm leading-relaxed text-neutral-300 relative">
                            <p className="whitespace-pre-wrap">{analysis || "Run analysis to generate AI root-cause details."}</p>
                            <div className="absolute top-4 right-4 text-cyan-500/50"><BrainCircuit className="h-20 w-20 opacity-10" /></div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-neutral-300 mb-3 flex items-center gap-2 uppercase tracking-wide"><CheckCircle className="h-4 w-4 text-emerald-400" /> Scenario Recommendations</h3>
                        <div className="space-y-2 text-sm text-neutral-300">
                            {suggestions.length === 0 && <div className="text-neutral-500">No scenario suggestions available.</div>}
                            {suggestions.map((s, i) => {
                                const key = `${s.type}:${s.targetComponentId}:${i}`;
                                const loadingInject = injecting === `${s.type}:${s.targetComponentId}`;
                                return (
                                    <div key={key} className="p-3 border border-neutral-800 rounded-lg bg-neutral-950/70 flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-neutral-200">{s.type}</div>
                                            <div className="text-xs text-neutral-500 mt-0.5">Target: {s.targetComponentId} | Severity {s.severity.toFixed(2)} | Duration {s.durationTicks} ticks</div>
                                            <div className="text-xs text-neutral-400 mt-1">{s.rationale}</div>
                                        </div>
                                        <button
                                            onClick={() => void injectSuggestion(s)}
                                            disabled={loadingInject}
                                            className="px-2.5 py-1.5 text-xs rounded-md bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                                        >
                                            {loadingInject ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                                            Inject
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-neutral-300 mb-3 uppercase tracking-wide">Recommended Action Checklist</h3>
                        <div className="space-y-2">
                            {actionChecklist.map((item, idx) => (
                                <div key={idx} className="rounded-lg border border-neutral-800 bg-neutral-950/80 px-3 py-2 text-sm text-neutral-300">
                                    <span className="text-cyan-400 font-semibold mr-2">{idx + 1}.</span>{item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
