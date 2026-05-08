import { Router } from 'express';
import { prisma } from '../appContext';

const router = Router();

// Get telemetry data for a system with filtering
router.get('/:systemId', async (req: any, res: any) => {
    try {
        const { systemId } = req.params;
        const { from, to, component, metric, limit } = req.query;

        const where: any = { systemId };

        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp.gte = new Date(from as string);
            if (to) where.timestamp.lte = new Date(to as string);
        }
        if (component) where.componentId = component as string;
        if (metric) where.metric = metric as string;

        const data = await prisma.telemetryData.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: parseInt(limit as string) || 200
        });

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

export default router;
