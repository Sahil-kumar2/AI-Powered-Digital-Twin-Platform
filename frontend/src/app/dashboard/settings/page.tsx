"use client";
import React, { useMemo, useState } from "react";
import { Shield, SlidersHorizontal, Database, HardDrive, Cpu, Bell, RotateCcw, Save } from "lucide-react";

type SettingsTab = "simulation" | "ai" | "alerts" | "retention" | "security";

type PlatformSettings = {
    simulation: {
        maxConcurrent: number;
        defaultTickMs: number;
        autoSaveBeforeRun: boolean;
    };
    ai: {
        anomalyThreshold: number;
        riskAlertThreshold: number;
        askTopK: number;
    };
    alerts: {
        autoResolveMinutes: number;
        minSeverity: "warning" | "high" | "critical";
        notifyOnScenarioFailures: boolean;
    };
    retention: {
        rawDays: number;
        aggregateDays: number;
        exportEnabled: boolean;
    };
    security: {
        sessionTimeoutMinutes: number;
        requireMfa: boolean;
        apiKeyRotationDays: number;
    };
};

const STORAGE_KEY = "digital_twin_platform_settings";

const DEFAULT_SETTINGS: PlatformSettings = {
    simulation: {
        maxConcurrent: 5,
        defaultTickMs: 1000,
        autoSaveBeforeRun: true,
    },
    ai: {
        anomalyThreshold: 0.8,
        riskAlertThreshold: 0.7,
        askTopK: 4,
    },
    alerts: {
        autoResolveMinutes: 120,
        minSeverity: "warning",
        notifyOnScenarioFailures: true,
    },
    retention: {
        rawDays: 7,
        aggregateDays: 30,
        exportEnabled: true,
    },
    security: {
        sessionTimeoutMinutes: 480,
        requireMfa: false,
        apiKeyRotationDays: 90,
    },
};

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("simulation");
    const [settings, setSettings] = useState<PlatformSettings>(() => {
        if (typeof window === "undefined") return DEFAULT_SETTINGS;
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return DEFAULT_SETTINGS;
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as PlatformSettings;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });
    const [savedAt, setSavedAt] = useState<string | null>(null);

    const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS) || Boolean(savedAt), [settings, savedAt]);

    const saveSettings = () => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        setSavedAt(new Date().toLocaleTimeString());
    };

    const resetDefaults = () => {
        setSettings(DEFAULT_SETTINGS);
        setSavedAt(null);
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6 h-full pb-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Platform Settings</h1>
                    <p className="text-neutral-400 text-sm mt-1">Set simulation, AI, alerting, retention, and security defaults for your workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={resetDefaults} className="px-3 py-2 border border-neutral-700 text-neutral-300 rounded-md text-sm hover:text-white hover:border-neutral-500 inline-flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" /> Reset
                    </button>
                    <button onClick={saveSettings} className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 rounded-md text-sm font-semibold inline-flex items-center gap-2">
                        <Save className="h-4 w-4" /> Save
                    </button>
                </div>
            </div>

            {(savedAt || isDirty) && (
                <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/20 px-4 py-2 text-xs text-cyan-200">
                    {savedAt ? `Saved at ${savedAt}` : "Unsaved changes"}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8 flex-1">
                <div className="w-full lg:w-64 shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
                    <button onClick={() => setActiveTab("simulation")} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors border whitespace-nowrap ${activeTab === "simulation" ? "bg-neutral-800 text-white border-neutral-700" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white border-transparent"}`}><SlidersHorizontal className="h-4 w-4" /> Simulation</button>
                    <button onClick={() => setActiveTab("ai")} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors border whitespace-nowrap ${activeTab === "ai" ? "bg-neutral-800 text-white border-neutral-700" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white border-transparent"}`}><Cpu className="h-4 w-4" /> AI Configuration</button>
                    <button onClick={() => setActiveTab("alerts")} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors border whitespace-nowrap ${activeTab === "alerts" ? "bg-neutral-800 text-white border-neutral-700" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white border-transparent"}`}><Bell className="h-4 w-4" /> Alert Rules</button>
                    <button onClick={() => setActiveTab("retention")} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors border whitespace-nowrap ${activeTab === "retention" ? "bg-neutral-800 text-white border-neutral-700" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white border-transparent"}`}><Database className="h-4 w-4" /> Data Retention</button>
                    <button onClick={() => setActiveTab("security")} className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors border whitespace-nowrap ${activeTab === "security" ? "bg-neutral-800 text-white border-neutral-700" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-white border-transparent"}`}><Shield className="h-4 w-4" /> Security</button>
                </div>

                <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-6 flex flex-col gap-6 max-w-3xl">
                    {activeTab === "simulation" && (
                        <>
                            <h3 className="text-lg font-bold flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-cyan-400" /> Simulation Defaults</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="text-sm text-neutral-300">Max concurrent simulations
                                    <input type="number" min={1} max={100} value={settings.simulation.maxConcurrent} onChange={(e) => setSettings((prev) => ({ ...prev, simulation: { ...prev.simulation, maxConcurrent: Number(e.target.value) || 1 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                                <label className="text-sm text-neutral-300">Default telemetry tick (ms)
                                    <select value={settings.simulation.defaultTickMs} onChange={(e) => setSettings((prev) => ({ ...prev, simulation: { ...prev.simulation, defaultTickMs: Number(e.target.value) } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2">
                                        <option value={100}>100</option>
                                        <option value={500}>500</option>
                                        <option value={1000}>1000</option>
                                        <option value={2000}>2000</option>
                                    </select>
                                </label>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
                                <input type="checkbox" checked={settings.simulation.autoSaveBeforeRun} onChange={(e) => setSettings((prev) => ({ ...prev, simulation: { ...prev.simulation, autoSaveBeforeRun: e.target.checked } }))} /> Auto-save system before simulation start
                            </label>
                        </>
                    )}

                    {activeTab === "ai" && (
                        <>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Cpu className="h-5 w-5 text-blue-400" /> AI Thresholds</h3>
                            <div className="space-y-4">
                                <label className="block text-sm text-neutral-300">Anomaly threshold: {settings.ai.anomalyThreshold.toFixed(2)}
                                    <input type="range" min={0.5} max={0.99} step={0.01} value={settings.ai.anomalyThreshold} onChange={(e) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, anomalyThreshold: Number(e.target.value) } }))} className="w-full mt-2 accent-cyan-500" />
                                </label>
                                <label className="block text-sm text-neutral-300">Risk alert threshold: {settings.ai.riskAlertThreshold.toFixed(2)}
                                    <input type="range" min={0.4} max={0.95} step={0.01} value={settings.ai.riskAlertThreshold} onChange={(e) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, riskAlertThreshold: Number(e.target.value) } }))} className="w-full mt-2 accent-cyan-500" />
                                </label>
                                <label className="text-sm text-neutral-300">Knowledge retrieval topK
                                    <input type="number" min={1} max={12} value={settings.ai.askTopK} onChange={(e) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, askTopK: Number(e.target.value) || 1 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                            </div>
                        </>
                    )}

                    {activeTab === "alerts" && (
                        <>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Bell className="h-5 w-5 text-amber-400" /> Alerting Essentials</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="text-sm text-neutral-300">Auto-resolve timeout (minutes)
                                    <input type="number" min={5} max={1440} value={settings.alerts.autoResolveMinutes} onChange={(e) => setSettings((prev) => ({ ...prev, alerts: { ...prev.alerts, autoResolveMinutes: Number(e.target.value) || 5 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                                <label className="text-sm text-neutral-300">Minimum severity for notifications
                                    <select value={settings.alerts.minSeverity} onChange={(e) => setSettings((prev) => ({ ...prev, alerts: { ...prev.alerts, minSeverity: e.target.value as "warning" | "high" | "critical" } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2">
                                        <option value="warning">warning</option>
                                        <option value="high">high</option>
                                        <option value="critical">critical</option>
                                    </select>
                                </label>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
                                <input type="checkbox" checked={settings.alerts.notifyOnScenarioFailures} onChange={(e) => setSettings((prev) => ({ ...prev, alerts: { ...prev.alerts, notifyOnScenarioFailures: e.target.checked } }))} /> Notify when injected scenarios trigger failures
                            </label>
                        </>
                    )}

                    {activeTab === "retention" && (
                        <>
                            <h3 className="text-lg font-bold flex items-center gap-2"><HardDrive className="h-5 w-5 text-emerald-400" /> Data Retention</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="text-sm text-neutral-300">Raw telemetry retention (days)
                                    <input type="number" min={1} max={365} value={settings.retention.rawDays} onChange={(e) => setSettings((prev) => ({ ...prev, retention: { ...prev.retention, rawDays: Number(e.target.value) || 1 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                                <label className="text-sm text-neutral-300">Aggregated retention (days)
                                    <input type="number" min={7} max={730} value={settings.retention.aggregateDays} onChange={(e) => setSettings((prev) => ({ ...prev, retention: { ...prev.retention, aggregateDays: Number(e.target.value) || 7 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
                                <input type="checkbox" checked={settings.retention.exportEnabled} onChange={(e) => setSettings((prev) => ({ ...prev, retention: { ...prev.retention, exportEnabled: e.target.checked } }))} /> Enable telemetry export workflows
                            </label>
                        </>
                    )}

                    {activeTab === "security" && (
                        <>
                            <h3 className="text-lg font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-rose-400" /> Security Essentials</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="text-sm text-neutral-300">Session timeout (minutes)
                                    <input type="number" min={30} max={1440} value={settings.security.sessionTimeoutMinutes} onChange={(e) => setSettings((prev) => ({ ...prev, security: { ...prev.security, sessionTimeoutMinutes: Number(e.target.value) || 30 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                                <label className="text-sm text-neutral-300">API key rotation interval (days)
                                    <input type="number" min={7} max={365} value={settings.security.apiKeyRotationDays} onChange={(e) => setSettings((prev) => ({ ...prev, security: { ...prev.security, apiKeyRotationDays: Number(e.target.value) || 7 } }))} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2" />
                                </label>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
                                <input type="checkbox" checked={settings.security.requireMfa} onChange={(e) => setSettings((prev) => ({ ...prev, security: { ...prev.security, requireMfa: e.target.checked } }))} /> Require MFA for admin logins
                            </label>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
