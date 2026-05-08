import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryProcessor } from '../src/services/TelemetryProcessor';

describe('TelemetryProcessor integration', () => {
    let bus: EventEmitter;

    beforeEach(() => {
        bus = new EventEmitter();
    });

    afterEach(() => {
        bus.removeAllListeners();
    });

    it('ingests telemetry and creates alert when rule threshold is crossed', async () => {
        const prisma = {
            telemetryData: {
                createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            alertRule: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        id: 'rule-1',
                        systemId: 'sys-1',
                        metric: 'temperature',
                        operator: 'gt',
                        threshold: 70,
                        severity: 'warning',
                        enabled: true,
                    },
                ]),
            },
            alert: {
                findFirst: vi.fn().mockResolvedValue(null),
                create: vi.fn().mockResolvedValue({
                    id: 'alert-1',
                    systemId: 'sys-1',
                    status: 'active',
                    message: 'temperature gt 70 triggered (value: 75)',
                }),
            },
        } as any;

        const processor = new TelemetryProcessor(prisma, bus);

        const liveAlerts: any[] = [];
        bus.on('alert:live', (a) => liveAlerts.push(a));

        processor.start();
        bus.emit('telemetry', {
            systemId: 'sys-1',
            componentId: 'cmp-1',
            metric: 'temperature',
            value: 75,
            timestamp: new Date().toISOString(),
        });

        await (processor as any).flush();

        expect(prisma.telemetryData.createMany).toHaveBeenCalledTimes(1);
        expect(prisma.alert.create).toHaveBeenCalledTimes(1);
        expect(liveAlerts).toHaveLength(1);

        processor.stop();
    });
});
