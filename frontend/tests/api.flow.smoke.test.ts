import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auth, systems, simulation, telemetry, alerts } from '@/lib/api';

function okJson(body: any, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as Response;
}

describe('Frontend API smoke flow', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('token', 'jwt-token');
        vi.restoreAllMocks();
    });

    it('runs login -> create system -> run simulation -> read telemetry -> resolve alert', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockImplementation(async (input: any) => {
            const url = String(input);
            if (url.endsWith('/auth/login')) {
                return okJson({ token: 'jwt-token', user: { id: 'u-1', email: 'eng@example.com' } });
            }
            if (url.endsWith('/systems/create')) {
                return okJson({ id: 'sys-1', name: 'HVAC Twin' }, 201);
            }
            if (url.endsWith('/simulation/start/sys-1')) {
                return okJson({ message: 'Simulation started', systemId: 'sys-1' });
            }
            if (url.includes('/telemetry/sys-1')) {
                return okJson([{ metric: 'temperature', value: 62 }]);
            }
            if (url.endsWith('/alerts/a-1/resolve')) {
                return okJson({ id: 'a-1', status: 'resolved' });
            }
            return okJson({}, 404);
        });

        const login = await auth.login('eng@example.com', 'secret123');
        expect(login.token).toBe('jwt-token');

        const created = await systems.create('HVAC Twin', 'Line A');
        expect(created.id).toBe('sys-1');

        const started = await simulation.start('sys-1', 1000);
        expect(started.systemId).toBe('sys-1');

        const telemetryRows = await telemetry.get('sys-1', { limit: 10 });
        expect(telemetryRows).toHaveLength(1);

        const resolved = await alerts.resolve('a-1');
        expect(resolved.status).toBe('resolved');

        expect(fetchMock).toHaveBeenCalledTimes(5);
    });
});
