import { Router } from 'express';
import { prisma } from '../appContext';
import jwt from 'jsonwebtoken';

const router = Router();

// Auth Middleware
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

// Add Component to System
router.post('/add', async (req: any, res: any) => {
    try {
        const { systemId, type, name, x, y, parameters } = req.body;

        // Verify system ownership
        const system = await prisma.electronicSystem.findUnique({ where: { id: systemId } });
        if (!system || system.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        const component = await prisma.component.create({
            data: {
                systemId, type, name, x, y, parameters: JSON.stringify(parameters || {})
            }
        });

        res.status(201).json(component);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add component' });
    }
});

// Remove Component
router.delete('/:id', async (req: any, res: any) => {
    try {
        const component = await prisma.component.findUnique({
            where: { id: req.params.id },
            include: { system: true }
        });
        if (!component || component.system.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

        await prisma.component.delete({ where: { id: req.params.id } });
        res.json({ message: 'Component deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete component' });
    }
});

export default router;
