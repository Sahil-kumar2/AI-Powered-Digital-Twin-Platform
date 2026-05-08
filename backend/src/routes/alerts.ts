import { Router } from 'express';
import { prisma } from '../appContext';

const router = Router();

// ── Alert Rules CRUD ────────────────────────────────────

// Create alert rule
router.post('/rules', async (req: any, res: any) => {
    try {
        const { systemId, metric, operator, threshold, severity } = req.body;
        const rule = await prisma.alertRule.create({
            data: { systemId, metric, operator, threshold, severity }
        });
        res.status(201).json(rule);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create alert rule' });
    }
});

// Get alert rules for a system
router.get('/rules/:systemId', async (req: any, res: any) => {
    try {
        const rules = await prisma.alertRule.findMany({
            where: { systemId: req.params.systemId }
        });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alert rules' });
    }
});

// Delete alert rule
router.delete('/rules/:id', async (req: any, res: any) => {
    try {
        await prisma.alertRule.delete({ where: { id: req.params.id } });
        res.json({ message: 'Rule deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

// ── Alerts ──────────────────────────────────────────────

// Get alerts for a system
router.get('/:systemId', async (req: any, res: any) => {
    try {
        const { status, severity } = req.query;
        const where: any = { systemId: req.params.systemId };
        if (status) where.status = status as string;
        if (severity) where.severity = severity as string;

        const alerts = await prisma.alert.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// Acknowledge alert
router.post('/:id/acknowledge', async (req: any, res: any) => {
    try {
        const alert = await prisma.alert.update({
            where: { id: req.params.id },
            data: { status: 'acknowledged' }
        });
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// Resolve alert
router.post('/:id/resolve', async (req: any, res: any) => {
    try {
        const alert = await prisma.alert.update({
            where: { id: req.params.id },
            data: { status: 'resolved', resolvedAt: new Date() }
        });
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve alert' });
    }
});

export default router;
