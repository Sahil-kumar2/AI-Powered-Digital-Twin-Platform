import { Router } from 'express';
import { prisma } from '../appContext';
import jwt from 'jsonwebtoken';

const router = Router();

// Simple auth middleware
const auth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET!);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};

router.use(auth);

// Create System
router.post('/create', async (req: any, res: any) => {
    try {
        const { name, description } = req.body;
        const system = await prisma.electronicSystem.create({
            data: { name, description, userId: req.user.id }
        });
        res.status(201).json(system);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create system' });
    }
});

// Get User Systems
router.get('/', async (req: any, res: any) => {
    const systems = await prisma.electronicSystem.findMany({ where: { userId: req.user.id } });
    res.json(systems);
});

// Get Single System with components
router.get('/:id', async (req: any, res: any) => {
    const system = await prisma.electronicSystem.findUnique({
        where: { id: req.params.id },
        include: { components: true, connections: true }
    });
    if (system?.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(system);
});

// ────── BULK SAVE: components + connections ──────
// This replaces all components and connections in one transaction
router.put('/:id/save', async (req: any, res: any) => {
    try {
        const system = await prisma.electronicSystem.findUnique({ where: { id: req.params.id } });
        if (!system || system.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const comps = Array.isArray(req.body.components) ? req.body.components : [];
        const conns = Array.isArray(req.body.connections) ? req.body.connections : [];

        await prisma.$transaction([
            prisma.connection.deleteMany({ where: { systemId: req.params.id } }),
            prisma.component.deleteMany({ where: { systemId: req.params.id } }),
            prisma.component.createMany({
                data: comps.map((c: any) => ({
                    id: c.id,
                    systemId: req.params.id,
                    type: c.type,
                    name: c.name,
                    x: c.x,
                    y: c.y,
                    parameters: c.parameters || '{}',
                })),
            }),
            prisma.connection.createMany({
                data: conns.map((conn: any) => ({
                    id: conn.id,
                    systemId: req.params.id,
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    sourcePin: conn.sourceHandle || null,
                    targetPin: conn.targetHandle || null,
                })),
            }),
        ]);

        res.json({ message: 'System saved', components: comps.length, connections: conns.length });
    } catch (error: any) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save system: ' + error.message });
    }
});

// Delete System
router.delete('/:id', async (req: any, res: any) => {
    try {
        const system = await prisma.electronicSystem.findUnique({ where: { id: req.params.id } });
        if (!system || system.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        // Delete cascading records
        await prisma.alert.deleteMany({ where: { systemId: req.params.id } });
        await prisma.alertRule.deleteMany({ where: { systemId: req.params.id } });
        await prisma.telemetryData.deleteMany({ where: { systemId: req.params.id } });
        await prisma.simulationConfig.deleteMany({ where: { systemId: req.params.id } });
        await prisma.connection.deleteMany({ where: { systemId: req.params.id } });
        await prisma.component.deleteMany({ where: { systemId: req.params.id } });
        await prisma.electronicSystem.delete({ where: { id: req.params.id } });

        res.json({ message: 'System deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete system' });
    }
});

export default router;

