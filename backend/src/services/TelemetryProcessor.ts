import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { TelemetryTick } from './SimulationEngine';
import type { AiServiceClient } from './AiServiceClient';

/**
 * TelemetryProcessor listens for telemetry events on the bus,
 * batches them, persists to Postgres, evaluates alert rules,
 * and re-emits processed data for WebSocket broadcasting.
 */
export class TelemetryProcessor {
    private prisma: PrismaClient;
    private bus: EventEmitter;
    private aiClient?: AiServiceClient;
    private buffer: TelemetryTick[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private lastAiRunBySystem: Map<string, number> = new Map();

    private static FLUSH_INTERVAL_MS = 500;
    private static MAX_BUFFER_SIZE = 100;

    constructor(prisma: PrismaClient, bus: EventEmitter, aiClient?: AiServiceClient) {
        this.prisma = prisma;
        this.bus = bus;
        this.aiClient = aiClient;
    }

    start() {
        // Listen for telemetry events from the simulation engine
        this.bus.on('telemetry', (tick: TelemetryTick) => {
            this.buffer.push(tick);

            // Re-emit immediately for live WebSocket streaming
            this.bus.emit('telemetry:live', tick);

            if (this.buffer.length >= TelemetryProcessor.MAX_BUFFER_SIZE) {
                this.flush();
            }
        });

        // Periodic flush
        this.flushTimer = setInterval(() => {
            if (this.buffer.length > 0) {
                this.flush();
            }
        }, TelemetryProcessor.FLUSH_INTERVAL_MS);

        console.log('[TelemetryProcessor] Started — batching telemetry with 500ms flush intervals.');
    }

    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.bus.removeAllListeners('telemetry');
    }

    /**
     * Batch-insert accumulated telemetry rows into the database
     * and evaluate alert rules for each system.
     */
    private async flush() {
        const batch = this.buffer.splice(0);
        if (batch.length === 0) return;

        try {
            // Bulk insert
            await this.prisma.telemetryData.createMany({
                data: batch.map(t => ({
                    systemId: t.systemId,
                    componentId: t.componentId,
                    metric: t.metric,
                    value: t.value,
                    timestamp: new Date(t.timestamp)
                }))
            });

            // Evaluate alert rules per system
            const systemIds = [...new Set(batch.map(t => t.systemId))];
            for (const systemId of systemIds) {
                const ticks = batch.filter(t => t.systemId === systemId);
                await this.evaluateAlerts(systemId, ticks);
                await this.runAiAnalysis(systemId, ticks);
            }
        } catch (err) {
            console.error('[TelemetryProcessor] Flush error:', err);
        }
    }

    /**
     * Run AI anomaly/failure analysis at a controlled cadence per system.
     * Emits ai:insight events and raises alerts for critical failure risk.
     */
    private async runAiAnalysis(systemId: string, ticks: TelemetryTick[]) {
        if (!this.aiClient || ticks.length === 0) return;

        const now = Date.now();
        const lastRun = this.lastAiRunBySystem.get(systemId) || 0;
        // Run at most every 30 seconds per system to avoid excessive inference costs.
        if (now - lastRun < 30000) return;
        this.lastAiRunBySystem.set(systemId, now);

        try {
            const payload = ticks.map((t) => ({
                componentId: t.componentId,
                metric: t.metric,
                value: t.value,
                timestamp: t.timestamp,
            }));

            const [anomaly, failure] = await Promise.all([
                this.aiClient.detectAnomaly({ systemId, telemetry: payload }),
                this.aiClient.predictFailure({ systemId, telemetry: payload, horizonMinutes: 180 }),
            ]);

            this.bus.emit('ai:insight', {
                systemId,
                anomaly,
                failure,
                timestamp: new Date().toISOString(),
            });

            if (failure.failureProbability >= 0.9) {
                const existing = await this.prisma.alert.findFirst({
                    where: {
                        systemId,
                        status: 'active',
                        message: { contains: 'AI predicts' },
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (!existing) {
                    const alert = await this.prisma.alert.create({
                        data: {
                            systemId,
                            severity: 'critical',
                            message: `AI predicts ${Math.round(failure.failureProbability * 100)}% failure risk within 180m`,
                            status: 'active',
                        },
                    });
                    this.bus.emit('alert:live', alert);
                }
            }
        } catch (err) {
            console.warn(`[TelemetryProcessor] AI analysis skipped for ${systemId}:`, err);
        }
    }

    /**
     * Compare incoming telemetry against stored alert rules.
     * Fires alerts when thresholds are crossed.
     */
    private async evaluateAlerts(systemId: string, ticks: TelemetryTick[]) {
        const rules = await this.prisma.alertRule.findMany({
            where: { systemId, enabled: true }
        });

        for (const rule of rules) {
            for (const tick of ticks) {
                if (tick.metric !== rule.metric) continue;

                let triggered = false;
                switch (rule.operator) {
                    case 'gt': triggered = tick.value > rule.threshold; break;
                    case 'lt': triggered = tick.value < rule.threshold; break;
                    case 'gte': triggered = tick.value >= rule.threshold; break;
                    case 'lte': triggered = tick.value <= rule.threshold; break;
                    case 'eq': triggered = tick.value === rule.threshold; break;
                }

                if (triggered) {
                    // Deduplication: check if an active alert already exists for this rule
                    const existing = await this.prisma.alert.findFirst({
                        where: { systemId, ruleId: rule.id, status: 'active' }
                    });

                    if (!existing) {
                        const alert = await this.prisma.alert.create({
                            data: {
                                systemId,
                                ruleId: rule.id,
                                componentId: tick.componentId,
                                severity: rule.severity,
                                message: `${tick.metric} ${rule.operator} ${rule.threshold} triggered (value: ${tick.value})`,
                                status: 'active'
                            }
                        });
                        // Emit alert for live notification
                        this.bus.emit('alert:live', alert);
                        console.log(`[AlertEngine] Fired: ${alert.message}`);
                    }
                }
            }
        }
    }
}
