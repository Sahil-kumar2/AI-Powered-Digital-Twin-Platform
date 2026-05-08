import { EventEmitter } from 'events';

type AppContext = {
    prisma: any;
    bus: EventEmitter;
    simulationEngine: any;
    aiServiceClient: any;
};

let context: AppContext | null = null;

export function setAppContext(next: AppContext) {
    context = next;
}

function getContext(): AppContext {
    if (!context) {
        throw new Error('App context not initialized');
    }
    return context;
}

export const prisma = new Proxy({} as any, {
    get(_target, prop) {
        return (getContext().prisma as any)[prop as any];
    },
});

export const bus = new Proxy(new EventEmitter(), {
    get(_target, prop) {
        return (getContext().bus as any)[prop as any];
    },
}) as EventEmitter;

export const simulationEngine = new Proxy({} as any, {
    get(_target, prop) {
        return (getContext().simulationEngine as any)[prop as any];
    },
});

export const aiServiceClient = new Proxy({} as any, {
    get(_target, prop) {
        return (getContext().aiServiceClient as any)[prop as any];
    },
});
