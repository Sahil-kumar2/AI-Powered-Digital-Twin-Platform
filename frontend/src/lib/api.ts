function normalizeBaseUrl(value: string) {
    return value.replace(/\/+$/, "");
}

const API_BASE = `${normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")}/api`;

export class ApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;

    constructor(message: string, status = 0, code?: string, details?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number) {
    return status === 429 || status >= 500;
}

function isRetryableMethod(method: string) {
    return method === "GET" || method === "HEAD";
}

async function parseJsonSafe(res: Response) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function getErrorMessage(err: unknown, fallback = "Request failed") {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return fallback;
}

function isAiUnavailableError(err: unknown) {
    const msg = getErrorMessage(err, "").toLowerCase();
    if (err instanceof ApiError && (err.status === 503 || err.status >= 500)) return true;
    return msg.includes("ai service") || msg.includes("unavailable") || msg.includes("network error");
}

/**
 * Shared API client for the Digital Twin frontend.
 * Automatically attaches JWT tokens from localStorage.
 */
async function request(path: string, options: RequestInit = {}, retries?: number) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const method = (options.method || "GET").toUpperCase();
    const maxRetries = retries ?? (isRetryableMethod(method) ? 2 : 0);

    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

            if (res.status === 401) {
                if (typeof window !== "undefined") {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    window.location.href = "/login";
                }
                throw new ApiError("Unauthorized", 401);
            }

            const data = await parseJsonSafe(res);

            if (!res.ok) {
                const message = data?.error || data?.message || data?.detail || `Request failed (${res.status})`;
                if (attempt < maxRetries && shouldRetry(res.status)) {
                    await sleep(250 * (attempt + 1));
                    attempt += 1;
                    continue;
                }
                throw new ApiError(message, res.status, data?.code, data);
            }

            return data;
        } catch (err: any) {
            const networkLike = err instanceof TypeError || err?.name === "AbortError";
            if (attempt < maxRetries && networkLike) {
                await sleep(250 * (attempt + 1));
                attempt += 1;
                continue;
            }

            if (err instanceof ApiError) throw err;
            throw new ApiError(getErrorMessage(err, "Network error"), 0);
        }
    }
}

export { getErrorMessage, isAiUnavailableError };

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const auth = {
    login: (email: string, password: string) =>
        request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

    register: (email: string, password: string, name: string) =>
        request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),

    getUser: () => {
        if (typeof window === "undefined") return null;
        const u = localStorage.getItem("user");
        return u ? JSON.parse(u) : null;
    },

    getToken: () => typeof window !== "undefined" ? localStorage.getItem("token") : null,

    logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
    },
};

// â”€â”€ Systems â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const systems = {
    list: () => request("/systems"),
    get: (id: string) => request(`/systems/${id}`),
    create: (name: string, description?: string) =>
        request("/systems/create", { method: "POST", body: JSON.stringify({ name, description }) }),
    delete: (id: string) => request(`/systems/${id}`, { method: "DELETE" }),
    save: (id: string, components: any[], connections: any[]) =>
        request(`/systems/${id}/save`, { method: "PUT", body: JSON.stringify({ components, connections }) }),
};

// â”€â”€ Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const components = {
    add: (systemId: string, type: string, name: string, x: number, y: number, parameters?: any) =>
        request("/components/add", { method: "POST", body: JSON.stringify({ systemId, type, name, x, y, parameters }) }),
    remove: (id: string) => request(`/components/${id}`, { method: "DELETE" }),
};

// â”€â”€ Simulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const simulation = {
    start: (systemId: string, tickMs?: number, failures?: string) =>
        request(`/simulation/start/${systemId}`, { method: "POST", body: JSON.stringify({ tickMs, failures }) }),
    stop: (systemId: string) =>
        request(`/simulation/stop/${systemId}`, { method: "POST" }),
    status: (systemId: string) => request(`/simulation/status/${systemId}`),
    injectScenario: (systemId: string, data: { type: string; targetComponentId: string; severity?: number; durationTicks?: number }) =>
        request(`/simulation/scenario/${systemId}`, { method: "POST", body: JSON.stringify(data) }),
    removeScenario: (systemId: string, scenarioId: string) =>
        request(`/simulation/scenario/${systemId}/${scenarioId}`, { method: "DELETE" }),
    listScenarios: (systemId: string) => request(`/simulation/scenarios/${systemId}`),
};

// â”€â”€ Telemetry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const telemetry = {
    get: (systemId: string, params?: { from?: string; to?: string; component?: string; metric?: string; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.from) q.set("from", params.from);
        if (params?.to) q.set("to", params.to);
        if (params?.component) q.set("component", params.component);
        if (params?.metric) q.set("metric", params.metric);
        if (params?.limit) q.set("limit", String(params.limit));
        return request(`/telemetry/${systemId}?${q.toString()}`);
    },
};

// â”€â”€ Alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const alerts = {
    list: (systemId: string, status?: string) => {
        const q = status ? `?status=${status}` : "";
        return request(`/alerts/${systemId}${q}`);
    },
    acknowledge: (id: string) => request(`/alerts/${id}/acknowledge`, { method: "POST" }),
    resolve: (id: string) => request(`/alerts/${id}/resolve`, { method: "POST" }),
};

// â”€â”€ Alert Rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const alertRules = {
    list: (systemId: string) => request(`/alerts/rules/${systemId}`),
    create: (systemId: string, metric: string, operator: string, threshold: number, severity: string) =>
        request("/alerts/rules", { method: "POST", body: JSON.stringify({ systemId, metric, operator, threshold, severity }) }),
    remove: (id: string) => request(`/alerts/rules/${id}`, { method: "DELETE" }),
};

export const ai = {
    health: () => request("/ai/health"),
    anomaly: async (systemId: string, limit = 300) => {
        try {
            return await request(`/ai/anomaly/${systemId}`, { method: "POST", body: JSON.stringify({ limit }) }, 1);
        } catch (err) {
            if (!isAiUnavailableError(err)) throw err;
            return { systemId, isAnomalous: false, flaggedCount: 0, metricStats: [], fallback: true };
        }
    },
    failure: async (systemId: string, horizonMinutes = 240) => {
        try {
            return await request(`/ai/failure/${systemId}`, { method: "POST", body: JSON.stringify({ horizonMinutes }) }, 1);
        } catch (err) {
            if (!isAiUnavailableError(err)) throw err;
            return {
                systemId,
                failureProbability: 0,
                riskLevel: "low",
                horizonMinutes,
                factors: [],
                fallback: true,
            };
        }
    },
    searchKnowledge: async (query: string, namespace?: string, topK = 4) => {
        try {
            return await request("/ai/knowledge/search", { method: "POST", body: JSON.stringify({ query, namespace, topK }) }, 1);
        } catch (err) {
            if (!isAiUnavailableError(err)) throw err;
            return { query, namespace, topK, matches: [], fallback: true };
        }
    },
    upsertKnowledge: (documents: Array<{ id?: string; text: string; metadata?: Record<string, any> }>, namespace?: string) =>
        request("/ai/knowledge/upsert", { method: "POST", body: JSON.stringify({ documents, namespace }) }, 1),
    ask: async (question: string, opts?: { systemId?: string; namespace?: string; topK?: number }) => {
        try {
            return await request("/ai/llm/ask", { method: "POST", body: JSON.stringify({ question, ...opts }) }, 1);
        } catch (err) {
            if (!isAiUnavailableError(err)) throw err;
            return {
                answer: "AI service is temporarily unavailable. Please retry shortly. In the meantime, review live telemetry and alert trends to continue investigation.",
                references: [],
                fallback: true,
            };
        }
    },
    suggestScenarios: async (systemId: string) => {
        try {
            return await request(`/ai/scenario/suggest/${systemId}`, { method: "POST" }, 1);
        } catch (err) {
            if (!isAiUnavailableError(err)) throw err;
            return { systemId, suggestions: [], fallback: true };
        }
    },
};

export default { auth, systems, components, simulation, telemetry, alerts, alertRules, ai };
