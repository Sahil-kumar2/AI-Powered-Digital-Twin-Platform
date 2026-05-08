import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setAppContext } from './appContext';

import authRoutes from './routes/auth';
import systemsRoutes from './routes/systems';
import componentsRoutes from './routes/components';
import simulationRoutes from './routes/simulation';
import telemetryRoutes from './routes/telemetry';
import alertRoutes from './routes/alerts';
import aiRoutes from './routes/ai';

type AppDeps = {
    prisma: any;
    bus: any;
    simulationEngine: any;
    aiServiceClient: any;
};

export function createApp(deps: AppDeps) {
    setAppContext(deps);

    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, { cors: { origin: '*' } });

    app.use(cors());
    app.use(express.json());

    app.use('/api/auth', authRoutes);
    app.use('/api/systems', systemsRoutes);
    app.use('/api/components', componentsRoutes);
    app.use('/api/simulation', simulationRoutes);
    app.use('/api/telemetry', telemetryRoutes);
    app.use('/api/alerts', alertRoutes);
    app.use('/api/ai', aiRoutes);

    app.get('/api/health', (_, res) => {
        res.json({ status: 'ok', uptime: process.uptime() });
    });

    io.on('connection', (socket) => {
        socket.on('join_system', (systemId: string) => {
            socket.join(`system:${systemId}`);
        });

        socket.on('leave_system', (systemId: string) => {
            socket.leave(`system:${systemId}`);
        });
    });

    deps.bus.on('telemetry:live', (tick: any) => {
        io.to(`system:${tick.systemId}`).emit('telemetry:data', tick);
    });

    deps.bus.on('alert:live', (alert: any) => {
        io.to(`system:${alert.systemId}`).emit('alert:new', alert);
    });

    deps.bus.on('ai:insight', (insight: any) => {
        io.to(`system:${insight.systemId}`).emit('ai:insight', insight);
    });

    return { app, httpServer, io };
}
