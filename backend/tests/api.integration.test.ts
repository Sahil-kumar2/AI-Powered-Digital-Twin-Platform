import request from 'supertest';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/app';

function makeDeps() {
    const prisma = {
        user: { findUnique: vi.fn(), create: vi.fn() },
        electronicSystem: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
        component: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
        connection: { deleteMany: vi.fn(), create: vi.fn() },
        telemetryData: { findMany: vi.fn(), deleteMany: vi.fn() },
        simulationConfig: { deleteMany: vi.fn() },
        alertRule: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
        alert: { findMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
        $transaction: vi.fn(async (cb: any) => cb(prisma)),
    } as any;

    const bus = new EventEmitter();
    const simulationEngine = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(() => false),
        scenarioEngine: {
            inject: vi.fn(),
            remove: vi.fn(),
            list: vi.fn(() => []),
        },
    };
    const aiServiceClient = {
        health: vi.fn(),
        detectAnomaly: vi.fn(),
        predictFailure: vi.fn(),
        upsertKnowledge: vi.fn(),
        searchKnowledge: vi.fn(),
        askLlm: vi.fn(),
        suggestScenarios: vi.fn(),
    };

    const { app } = createApp({ prisma, bus, simulationEngine, aiServiceClient });
    return { app, prisma, simulationEngine, aiServiceClient };
}

describe('API integration', () => {
    beforeEach(() => {
        process.env.JWT_SECRET = 'test-secret';
    });

    it('auth register and login flow', async () => {
        const { app, prisma } = makeDeps();
        const users: any[] = [];

        prisma.user.findUnique.mockImplementation(async ({ where }: any) => users.find((u) => u.email === where.email) || null);
        prisma.user.create.mockImplementation(async ({ data }: any) => {
            const created = { id: `u-${users.length + 1}`, ...data };
            users.push(created);
            return created;
        });

        const register = await request(app).post('/api/auth/register').send({
            email: 'engineer@example.com',
            password: 'secret123',
            name: 'Engineer',
        });

        expect(register.status).toBe(201);
        expect(register.body.message).toBe('User created');

        const login = await request(app).post('/api/auth/login').send({
            email: 'engineer@example.com',
            password: 'secret123',
        });

        expect(login.status).toBe(200);
        expect(login.body.token).toBeTruthy();
        expect(login.body.user.email).toBe('engineer@example.com');
    });

    it('systems CRUD flow', async () => {
        const { app, prisma } = makeDeps();
        const token = jwt.sign({ id: 'u-1' }, process.env.JWT_SECRET as string);
        const systems: any[] = [];

        prisma.electronicSystem.create.mockImplementation(async ({ data }: any) => {
            const created = {
                id: `sys-${systems.length + 1}`,
                name: data.name,
                description: data.description,
                userId: data.userId,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            systems.push(created);
            return created;
        });

        prisma.electronicSystem.findMany.mockImplementation(async ({ where }: any) => systems.filter((s) => s.userId === where.userId));

        prisma.electronicSystem.findUnique.mockImplementation(async ({ where }: any) => {
            const found = systems.find((s) => s.id === where.id);
            if (!found) return null;
            return { ...found, components: [], connections: [] };
        });

        prisma.electronicSystem.delete.mockImplementation(async ({ where }: any) => {
            const idx = systems.findIndex((s) => s.id === where.id);
            if (idx >= 0) systems.splice(idx, 1);
            return { id: where.id };
        });

        prisma.alert.deleteMany.mockResolvedValue({ count: 0 });
        prisma.alertRule.deleteMany.mockResolvedValue({ count: 0 });
        prisma.telemetryData.deleteMany.mockResolvedValue({ count: 0 });
        prisma.simulationConfig.deleteMany.mockResolvedValue({ count: 0 });
        prisma.connection.deleteMany.mockResolvedValue({ count: 0 });
        prisma.component.deleteMany.mockResolvedValue({ count: 0 });

        const created = await request(app)
            .post('/api/systems/create')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'HVAC Monitor', description: 'Factory line A' });

        expect(created.status).toBe(201);
        expect(created.body.id).toBeTruthy();

        const list = await request(app).get('/api/systems').set('Authorization', `Bearer ${token}`);
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(1);

        const one = await request(app).get(`/api/systems/${created.body.id}`).set('Authorization', `Bearer ${token}`);
        expect(one.status).toBe(200);
        expect(one.body.id).toBe(created.body.id);

        const deleted = await request(app).delete(`/api/systems/${created.body.id}`).set('Authorization', `Bearer ${token}`);
        expect(deleted.status).toBe(200);
        expect(deleted.body.message).toBe('System deleted');
    });

    it('simulation start stop and status flow', async () => {
        const { app, simulationEngine } = makeDeps();

        simulationEngine.isRunning.mockReturnValueOnce(true);

        const start = await request(app).post('/api/simulation/start/sys-1').send({ tickMs: 500 });
        expect(start.status).toBe(200);
        expect(simulationEngine.start).toHaveBeenCalledWith('sys-1', 500, undefined);

        const status = await request(app).get('/api/simulation/status/sys-1');
        expect(status.status).toBe(200);
        expect(status.body.status).toBe('running');

        const stop = await request(app).post('/api/simulation/stop/sys-1').send({});
        expect(stop.status).toBe(200);
        expect(simulationEngine.stop).toHaveBeenCalledWith('sys-1');
    });

    it('alert lifecycle list acknowledge resolve', async () => {
        const { app, prisma } = makeDeps();
        const alerts = [
            {
                id: 'a-1',
                systemId: 'sys-1',
                severity: 'warning',
                message: 'temperature gt 80 triggered',
                status: 'active',
                createdAt: new Date(),
                resolvedAt: null,
                componentId: null,
                ruleId: null,
            },
        ];

        prisma.alert.findMany.mockImplementation(async ({ where }: any) => alerts.filter((a) => a.systemId === where.systemId));
        prisma.alert.update.mockImplementation(async ({ where, data }: any) => {
            const found = alerts.find((a) => a.id === where.id);
            if (!found) throw new Error('not found');
            Object.assign(found, data);
            return found;
        });

        const list = await request(app).get('/api/alerts/sys-1');
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].status).toBe('active');

        const ack = await request(app).post('/api/alerts/a-1/acknowledge').send({});
        expect(ack.status).toBe(200);
        expect(ack.body.status).toBe('acknowledged');

        const resolve = await request(app).post('/api/alerts/a-1/resolve').send({});
        expect(resolve.status).toBe(200);
        expect(resolve.body.status).toBe('resolved');
        expect(resolve.body.resolvedAt).toBeTruthy();
    });

    it('ai health fallback returns 503 when provider is down', async () => {
        const { app, aiServiceClient } = makeDeps();
        aiServiceClient.health.mockRejectedValue(new Error('AI offline'));

        const res = await request(app).get('/api/ai/health');
        expect(res.status).toBe(503);
        expect(res.body.error).toContain('AI offline');
    });
});
