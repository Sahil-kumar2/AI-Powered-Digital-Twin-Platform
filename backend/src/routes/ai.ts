import { Router } from 'express';
import { aiServiceClient, bus, prisma } from '../appContext';

const router = Router();

// Verify AI microservice availability and provider wiring.
router.get('/health', async (_req: any, res: any) => {
    try {
        const health = await aiServiceClient.health();
        res.json(health);
    } catch (err: any) {
        res.status(503).json({ error: err.message || 'AI service unavailable' });
    }
});

router.post('/anomaly/:systemId', async (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        const limit = Number(req.body?.limit || 300);

        const telemetry = await prisma.telemetryData.findMany({
            where: { systemId },
            orderBy: { timestamp: 'desc' },
            take: Math.min(Math.max(limit, 50), 1000),
        });

        if (telemetry.length === 0) {
            return res.json({ systemId, isAnomalous: false, flaggedCount: 0, metricStats: [] });
        }

        const payload = telemetry
            .reverse()
            .map((t: typeof telemetry[number]) => ({
                componentId: t.componentId,
                metric: t.metric,
                value: t.value,
                timestamp: t.timestamp.toISOString(),
            }));

        const result = await aiServiceClient.detectAnomaly({ systemId, telemetry: payload });

        if (result.isAnomalous) {
            const top = result.metricStats
                .filter((m: { flagged: boolean; metric: string; anomalyScore: number; zScore: number }) => m.flagged)
                .sort((a: { anomalyScore: number }, b: { anomalyScore: number }) => b.anomalyScore - a.anomalyScore)
                .slice(0, 3);

            for (const item of top) {
                const alert = await prisma.alert.create({
                    data: {
                        systemId,
                        severity: item.anomalyScore > 0.85 ? 'critical' : 'warning',
                        message: `AI anomaly on ${item.metric} (score=${item.anomalyScore.toFixed(2)}, z=${item.zScore.toFixed(2)})`,
                        status: 'active',
                    },
                });
                bus.emit('alert:live', alert);
            }
        }

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to run anomaly detection' });
    }
});

router.post('/failure/:systemId', async (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        const horizonMinutes = Number(req.body?.horizonMinutes || 240);

        const telemetry = await prisma.telemetryData.findMany({
            where: { systemId },
            orderBy: { timestamp: 'desc' },
            take: 500,
        });

        if (telemetry.length === 0) {
            return res.json({
                systemId,
                failureProbability: 0,
                riskLevel: 'low',
                horizonMinutes,
                factors: [],
            });
        }

        const payload = telemetry
            .reverse()
            .map((t: typeof telemetry[number]) => ({
                componentId: t.componentId,
                metric: t.metric,
                value: t.value,
                timestamp: t.timestamp.toISOString(),
            }));

        const result = await aiServiceClient.predictFailure({
            systemId,
            telemetry: payload,
            horizonMinutes,
        });

        if (result.failureProbability >= 0.7) {
            const alert = await prisma.alert.create({
                data: {
                    systemId,
                    severity: result.failureProbability >= 0.9 ? 'critical' : 'warning',
                    message: `AI predicts ${Math.round(result.failureProbability * 100)}% failure risk in ${horizonMinutes}m`,
                    status: 'active',
                },
            });
            bus.emit('alert:live', alert);
        }

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to predict failure risk' });
    }
});

router.post('/knowledge/upsert', async (req: any, res: any) => {
    try {
        const result = await aiServiceClient.upsertKnowledge({
            namespace: req.body?.namespace,
            documents: req.body?.documents || [],
        });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to upsert knowledge' });
    }
});

router.post('/knowledge/search', async (req: any, res: any) => {
    try {
        const { query, namespace, topK } = req.body || {};
        const result = await aiServiceClient.searchKnowledge({ query, namespace, topK });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to search knowledge base' });
    }
});

router.post('/llm/ask', async (req: any, res: any) => {
    try {
        const { question, systemId, namespace, topK } = req.body || {};
        if (!question) {
            return res.status(400).json({ error: 'question is required' });
        }

        let knowledgeContext: string[] = [];
        if (namespace || systemId) {
            const kb = await aiServiceClient.searchKnowledge({
                query: question,
                namespace: namespace || `system-${systemId}`,
                topK: Number(topK || 4),
            });
            knowledgeContext = kb.matches.map((m: { text: string }) => m.text);
        }

        const answer = await aiServiceClient.askLlm({
            question,
            systemContext: systemId ? { systemId } : undefined,
            knowledgeContext,
        });

        res.json({
            ...answer,
            references: knowledgeContext,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to get LLM answer' });
    }
});

router.post('/scenario/suggest/:systemId', async (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        const system = await prisma.electronicSystem.findUnique({
            where: { id: systemId },
            include: { components: true },
        });
        if (!system) return res.status(404).json({ error: 'System not found' });

        const telemetry = await prisma.telemetryData.findMany({
            where: { systemId },
            orderBy: { timestamp: 'desc' },
            take: 300,
        });

        const result = await aiServiceClient.suggestScenarios({
            systemId,
            telemetry: telemetry
                .reverse()
                .map((t: typeof telemetry[number]) => ({
                    componentId: t.componentId,
                    metric: t.metric,
                    value: t.value,
                    timestamp: t.timestamp.toISOString(),
                })),
            components: system.components.map((c: { id: string; name: string; type: string }) => ({
                id: c.id,
                name: c.name,
                type: c.type,
            })),
        });

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to suggest scenarios' });
    }
});

export default router;
