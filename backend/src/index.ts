import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

import { SimulationEngine } from './services/SimulationEngine';
import { TelemetryProcessor } from './services/TelemetryProcessor';
import { AiServiceClient } from './services/AiServiceClient';
import { createApp } from './app';

dotenv.config();

// Shared instances
export const prisma = new PrismaClient();
export const bus = new EventEmitter();
bus.setMaxListeners(100);

export const simulationEngine = new SimulationEngine(prisma, bus);
export const aiServiceClient = new AiServiceClient({
    baseUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    timeoutMs: Number(process.env.AI_SERVICE_TIMEOUT_MS || 12000),
});
export const telemetryProcessor = new TelemetryProcessor(prisma, bus, aiServiceClient);
const { httpServer } = createApp({
    prisma,
    bus,
    simulationEngine,
    aiServiceClient,
});

// ── Start ───────────────────────────────────────────────
telemetryProcessor.start();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log('[TelemetryProcessor] Pipeline active.');
});
