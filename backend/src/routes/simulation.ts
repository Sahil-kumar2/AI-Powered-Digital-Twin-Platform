import { Router } from 'express';
import { simulationEngine } from '../appContext';

const router = Router();

// ── Start simulation ────────────────────────────
router.post('/start/:systemId', async (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        const { tickMs, failures } = req.body;
        await simulationEngine.start(systemId, tickMs || 1000, failures);
        res.json({ message: 'Simulation started', systemId });
    } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to start simulation' });
    }
});

// ── Stop simulation ─────────────────────────────
router.post('/stop/:systemId', async (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        await simulationEngine.stop(systemId);
        res.json({ message: 'Simulation stopped', systemId });
    } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to stop simulation' });
    }
});

// ── Simulation status ───────────────────────────
router.get('/status/:systemId', (req: any, res: any) => {
    const running = simulationEngine.isRunning(req.params.systemId);
    res.json({ systemId: req.params.systemId, status: running ? 'running' : 'idle' });
});

// ══════════════════════════════════════════════════
// SCENARIO ENDPOINTS
// ══════════════════════════════════════════════════

// ── Inject a scenario ───────────────────────────
router.post('/scenario/:systemId', (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        const { type, targetComponentId, severity, startTick, durationTicks, params } = req.body;

        if (!type || !targetComponentId) {
            return res.status(400).json({ error: 'type and targetComponentId required' });
        }

        const scenario = simulationEngine.scenarioEngine.inject(systemId, {
            type,
            targetComponentId,
            severity: severity ?? 0.8,
            startTick: startTick ?? 0,
            durationTicks: durationTicks ?? -1,
            params: params ?? {},
        });

        res.json({ message: 'Scenario injected', scenario });
    } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to inject scenario' });
    }
});

// ── Remove a scenario ───────────────────────────
router.delete('/scenario/:systemId/:scenarioId', (req: any, res: any) => {
    const { systemId, scenarioId } = req.params;
    const removed = simulationEngine.scenarioEngine.remove(systemId, scenarioId);
    res.json({ removed });
});

// ── List active scenarios ───────────────────────
router.get('/scenarios/:systemId', (req: any, res: any) => {
    const { systemId } = req.params;
    const scenarios = simulationEngine.scenarioEngine.list(systemId);
    res.json(scenarios);
});

export default router;
