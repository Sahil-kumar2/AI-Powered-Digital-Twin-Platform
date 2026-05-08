type HttpMethod = 'GET' | 'POST';

export interface TelemetryPoint {
    componentId: string;
    metric: string;
    value: number;
    timestamp: string;
}

interface AiClientOptions {
    baseUrl: string;
    timeoutMs?: number;
}

interface RequestOptions {
    method?: HttpMethod;
    body?: unknown;
}

export class AiServiceClient {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;

    constructor(options: AiClientOptions) {
        this.baseUrl = options.baseUrl.replace(/\/$/, '');
        this.timeoutMs = options.timeoutMs ?? 12000;
    }

    private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method: options.method ?? 'GET',
                headers: { 'Content-Type': 'application/json' },
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal,
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const message = data?.detail || data?.error || `AI service request failed with ${res.status}`;
                throw new Error(message);
            }
            return data as T;
        } finally {
            clearTimeout(timer);
        }
    }

    health() {
        return this.request<{ status: string; providers: Record<string, string> }>('/health');
    }

    detectAnomaly(input: { systemId: string; telemetry: TelemetryPoint[]; window?: number }) {
        return this.request<{
            systemId: string;
            metricStats: Array<{ metric: string; latest: number; zScore: number; anomalyScore: number; flagged: boolean }>;
            flaggedCount: number;
            isAnomalous: boolean;
        }>('/anomaly/detect', { method: 'POST', body: input });
    }

    predictFailure(input: { systemId: string; telemetry: TelemetryPoint[]; horizonMinutes?: number }) {
        return this.request<{
            systemId: string;
            failureProbability: number;
            riskLevel: 'low' | 'medium' | 'high' | 'critical';
            horizonMinutes: number;
            factors: Array<{ metric: string; impact: number; latest: number }>;
        }>('/failure/predict', { method: 'POST', body: input });
    }

    searchKnowledge(input: { query: string; namespace?: string; topK?: number }) {
        return this.request<{
            matches: Array<{ id: string; score: number; text: string; metadata: Record<string, any> }>;
        }>('/knowledge/search', { method: 'POST', body: input });
    }

    upsertKnowledge(input: { namespace?: string; documents: Array<{ id?: string; text: string; metadata?: Record<string, any> }> }) {
        return this.request<{ upserted: number; namespace: string }>('/knowledge/upsert', { method: 'POST', body: input });
    }

    askLlm(input: {
        question: string;
        systemContext?: Record<string, any>;
        knowledgeContext?: string[];
        temperature?: number;
    }) {
        return this.request<{ answer: string; model: string }>('/llm/ask', { method: 'POST', body: input });
    }

    suggestScenarios(input: {
        systemId: string;
        telemetry: TelemetryPoint[];
        components: Array<{ id: string; name: string; type: string }>;
    }) {
        return this.request<{
            systemId: string;
            suggestions: Array<{
                type: string;
                targetComponentId: string;
                severity: number;
                durationTicks: number;
                rationale: string;
            }>;
        }>('/scenario/suggest', { method: 'POST', body: input });
    }
}
