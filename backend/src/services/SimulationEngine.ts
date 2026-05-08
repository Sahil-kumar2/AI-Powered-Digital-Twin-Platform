import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { ScenarioEngine, type Scenario } from './ScenarioEngine';

export interface TelemetryTick {
    systemId: string;
    componentId: string;
    metric: string;
    value: number;
    timestamp: string;
}

// ─── Component State ────────────────────────────
interface ComponentState {
    id: string;
    type: string;
    name: string;
    params: Record<string, any>;
    // Input values received from upstream this tick
    inputs: Record<string, number | null>;
    // Output values produced this tick
    outputs: Record<string, number | null>;
    // Persistent internal state (survives across ticks)
    internal: Record<string, any>;
}

// ─── System Graph ───────────────────────────────
interface SystemGraph {
    components: ComponentState[];
    connections: { sourceId: string; targetId: string; sourcePin: string; targetPin: string }[];
    executionOrder: string[];     // topologically sorted component IDs
    adjOut: Map<string, { targetId: string; sourcePin: string; targetPin: string }[]>;
}

/**
 * SimulationEngine v2 — Graph-aware signal propagation.
 *
 * Each tick:
 *  1. Clear all component inputs
 *  2. Iterate components in topological order
 *  3. Apply active scenarios (from ScenarioEngine)
 *  4. Execute component behavior model → produces outputs
 *  5. Propagate outputs to downstream inputs via connections
 *  6. Emit telemetry for each component
 */
export class SimulationEngine {
    private workers: Map<string, NodeJS.Timeout> = new Map();
    private graphs: Map<string, SystemGraph> = new Map();
    private prisma: PrismaClient;
    public bus: EventEmitter;
    public scenarioEngine: ScenarioEngine;

    constructor(prisma: PrismaClient, bus: EventEmitter) {
        this.prisma = prisma;
        this.bus = bus;
        this.scenarioEngine = new ScenarioEngine();
    }

    // ═══════════════════════════════════════════════
    // START / STOP
    // ═══════════════════════════════════════════════

    async start(systemId: string, tickMs = 1000, failures?: string) {
        if (this.workers.has(systemId)) {
            throw new Error(`Simulation already running for system ${systemId}`);
        }

        const system = await this.prisma.electronicSystem.findUnique({
            where: { id: systemId },
            include: { components: true, connections: true }
        });
        if (!system) throw new Error('System not found');

        // Build graph
        const graph = this.buildGraph(system);
        this.graphs.set(systemId, graph);

        // Legacy failure injection (from old API)
        if (failures) {
            try {
                const parsed = JSON.parse(failures);
                for (const f of parsed) {
                    this.scenarioEngine.inject(systemId, {
                        type: f.failureType || 'sensor_failure',
                        targetComponentId: f.componentId,
                        severity: 1.0,
                        startTick: 0,
                        durationTicks: -1,
                        params: {},
                    });
                }
            } catch { }
        }

        let tick = 0;
        const timer = setInterval(() => {
            tick++;
            this.executeTick(systemId, graph, tick);
        }, tickMs);

        this.workers.set(systemId, timer);

        await this.prisma.simulationConfig.create({
            data: { systemId, tickMs, speed: 1.0, failures: failures || null, status: 'running' }
        });

        console.log(`[SimEngine] Started for system ${systemId} (${graph.components.length} components, ${graph.connections.length} connections)`);
    }

    async stop(systemId: string) {
        const timer = this.workers.get(systemId);
        if (timer) {
            clearInterval(timer);
            this.workers.delete(systemId);
        }
        this.graphs.delete(systemId);
        this.scenarioEngine.clearAll(systemId);

        const configs = await this.prisma.simulationConfig.findMany({
            where: { systemId, status: 'running' },
            orderBy: { createdAt: 'desc' },
            take: 1
        });
        if (configs.length > 0) {
            await this.prisma.simulationConfig.update({
                where: { id: configs[0].id },
                data: { status: 'stopped' }
            });
        }
        console.log(`[SimEngine] Stopped for system ${systemId}`);
    }

    isRunning(systemId: string): boolean {
        return this.workers.has(systemId);
    }

    // ═══════════════════════════════════════════════
    // GRAPH BUILDING
    // ═══════════════════════════════════════════════

    private buildGraph(system: any): SystemGraph {
        const components: ComponentState[] = system.components.map((c: any) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            params: c.parameters ? JSON.parse(c.parameters) : {},
            inputs: {},
            outputs: {},
            internal: this.initInternalState(c.type),
        }));

        const connections = system.connections.map((c: any) => ({
            sourceId: c.sourceId,
            targetId: c.targetId,
            sourcePin: c.sourcePin || 'default',
            targetPin: c.targetPin || 'default',
        }));

        // Build adjacency list (source → targets)
        const adjOut = new Map<string, { targetId: string; sourcePin: string; targetPin: string }[]>();
        for (const c of connections) {
            if (!adjOut.has(c.sourceId)) adjOut.set(c.sourceId, []);
            adjOut.get(c.sourceId)!.push(c);
        }

        // Topological sort (Kahn's algorithm)
        const inDegree = new Map<string, number>();
        for (const comp of components) inDegree.set(comp.id, 0);
        for (const conn of connections) {
            inDegree.set(conn.targetId, (inDegree.get(conn.targetId) || 0) + 1);
        }
        const queue: string[] = [];
        for (const [id, deg] of inDegree) {
            if (deg === 0) queue.push(id);
        }
        const executionOrder: string[] = [];
        while (queue.length > 0) {
            const node = queue.shift()!;
            executionOrder.push(node);
            for (const edge of adjOut.get(node) || []) {
                const newDeg = (inDegree.get(edge.targetId) || 1) - 1;
                inDegree.set(edge.targetId, newDeg);
                if (newDeg === 0) queue.push(edge.targetId);
            }
        }
        // If any remaining (cycles), add them anyway
        for (const comp of components) {
            if (!executionOrder.includes(comp.id)) executionOrder.push(comp.id);
        }

        return { components, connections, executionOrder, adjOut };
    }

    private initInternalState(type: string): Record<string, any> {
        switch (type) {
            case 'MotorPump': return { state: 'OFF', rpm: 0, heatLevel: 0 };
            case 'Relay': return { closed: false };
            case 'Microcontroller': return { controlOutput: 0, mode: 'auto' };
            case 'PLCController': return { scan: 0 };
            case 'Battery': return { chargeLevel: 1.0 };
            case 'WiFiModule': return { txBuffer: 0, latency: 0 };
            case 'BluetoothModule': return { txBuffer: 0 };
            case 'EdgeProcessor': return { anomalyScore: 0 };
            default: return {};
        }
    }

    // ═══════════════════════════════════════════════
    // TICK EXECUTION
    // ═══════════════════════════════════════════════

    private executeTick(systemId: string, graph: SystemGraph, tick: number) {
        const compMap = new Map(graph.components.map(c => [c.id, c]));

        // 1. Clear all inputs
        for (const comp of graph.components) {
            comp.inputs = {};
        }

        // 2. Execute in topological order
        for (const compId of graph.executionOrder) {
            const comp = compMap.get(compId);
            if (!comp) continue;

            // 3. Apply scenarios
            const scenarios = this.scenarioEngine.getActiveForComponent(systemId, compId, tick);

            // 4. Execute behavior model
            const telemetry = this.executeComponent(comp, tick, scenarios);

            // 5. Propagate outputs to downstream inputs
            for (const edge of graph.adjOut.get(compId) || []) {
                const target = compMap.get(edge.targetId);
                if (target && comp.outputs[edge.sourcePin] !== undefined) {
                    target.inputs[edge.targetPin] = comp.outputs[edge.sourcePin];
                }
            }

            // 6. Emit telemetry
            for (const t of telemetry) {
                this.bus.emit('telemetry', {
                    systemId,
                    componentId: compId,
                    metric: t.metric,
                    value: t.value,
                    timestamp: new Date().toISOString(),
                } as TelemetryTick);
            }
        }
    }

    // ═══════════════════════════════════════════════
    // COMPONENT BEHAVIOR MODELS
    // ═══════════════════════════════════════════════

    private executeComponent(comp: ComponentState, tick: number, scenarios: Scenario[]): { metric: string; value: number }[] {
        const noise = (scale = 0.1) => (Math.random() - 0.5) * scale;
        const hasFailed = scenarios.some(s => s.type === 'sensor_failure');
        const noiseScenario = scenarios.find(s => s.type === 'signal_noise');
        const noiseMult = noiseScenario ? 1 + noiseScenario.severity * 5 : 1;
        const overheat = scenarios.find(s => s.type === 'component_overheat');

        // Power available from upstream?
        const powerIn = comp.inputs['pwr_in'] ?? null;
        const hasPower = powerIn !== null && powerIn > 0;

        switch (comp.type) {
            // ── SENSORS ─────────────────────────────
            case 'TemperatureSensor': {
                if (hasFailed) { comp.outputs['temp_out'] = null; return []; }
                const base = 25 + Math.sin(tick * 0.08) * 5;
                const heatEffect = overheat ? overheat.severity * tick * 0.5 : 0;
                const value = parseFloat((base + heatEffect + noise(2) * noiseMult).toFixed(2));
                comp.outputs['temp_out'] = value;
                return [{ metric: 'temperature', value }];
            }

            case 'HumiditySensor': {
                if (hasFailed) { comp.outputs['hum_out'] = null; return []; }
                const base = 50 + Math.sin(tick * 0.04) * 15;
                const value = parseFloat((base + noise(3) * noiseMult).toFixed(1));
                comp.outputs['hum_out'] = value;
                return [{ metric: 'humidity', value }];
            }

            case 'VoltageSensor': {
                if (hasFailed) { comp.outputs['volt_out'] = null; return []; }
                const measured = powerIn ?? 5.0;
                const value = parseFloat((measured + noise(0.1) * noiseMult).toFixed(3));
                comp.outputs['volt_out'] = value;
                return [{ metric: 'voltage', value }];
            }

            case 'PressureSensor': {
                if (hasFailed) { comp.outputs['pres_out'] = null; return []; }
                const base = 1.0 + Math.sin(tick * 0.05) * 0.3;
                const value = parseFloat((base + noise(0.1) * noiseMult).toFixed(2));
                comp.outputs['pres_out'] = value;
                return [{ metric: 'pressure', value }];
            }

            // ── POWER ───────────────────────────────
            case 'PowerSupply': {
                if (hasFailed) { comp.outputs['pwr_out'] = null; return []; }
                const dropScenario = scenarios.find(s => s.type === 'voltage_drop');
                const baseV = comp.params.outputVoltage || 5.0;
                const ripple = Math.sin(tick * 0.5) * (comp.params.ripple || 0.02) * baseV;
                const drop = dropScenario ? baseV * dropScenario.severity * 0.6 : 0;
                const value = parseFloat((baseV + ripple - drop + noise(0.01)).toFixed(3));
                comp.outputs['pwr_out'] = value;
                return [{ metric: 'voltage', value }];
            }

            case 'Battery': {
                if (hasFailed) { comp.outputs['pwr_out'] = null; comp.outputs['status_out'] = null; return []; }
                const dropScenario = scenarios.find(s => s.type === 'voltage_drop');
                const nomV = comp.params.nominalVoltage || 3.7;
                // Discharge slowly
                comp.internal.chargeLevel = Math.max(0, comp.internal.chargeLevel - 0.0005);
                const voltage = nomV * comp.internal.chargeLevel;
                const drop = dropScenario ? voltage * dropScenario.severity * 0.5 : 0;
                const v = parseFloat((voltage - drop + noise(0.01)).toFixed(3));
                comp.outputs['pwr_out'] = v;
                comp.outputs['status_out'] = comp.internal.chargeLevel;
                return [
                    { metric: 'voltage', value: v },
                    { metric: 'charge', value: parseFloat((comp.internal.chargeLevel * 100).toFixed(1)) },
                ];
            }

            // ── CONTROLLERS ─────────────────────────
            case 'Microcontroller': {
                if (hasFailed || !hasPower) {
                    comp.outputs['gpio_out'] = null; comp.outputs['pwm_out'] = null;
                    comp.outputs['serial_out'] = null; comp.outputs['data_out'] = null;
                    return hasPower ? [] : [{ metric: 'current', value: 0 }];
                }
                const adcIn = comp.inputs['adc_in'] ?? null;
                const serialIn = comp.inputs['serial_in'] ?? null;

                // Simple threshold controller: if input > 30, increase output
                let controlVal = comp.internal.controlOutput;
                if (adcIn !== null) {
                    if (adcIn > 40) controlVal = Math.min(1, controlVal + 0.1);
                    else if (adcIn < 25) controlVal = Math.max(0, controlVal - 0.1);
                }
                if (serialIn !== null) {
                    // Humidity-based: if > 70%, boost output
                    if (serialIn > 70) controlVal = Math.min(1, controlVal + 0.05);
                }
                comp.internal.controlOutput = parseFloat(controlVal.toFixed(3));

                // Outputs
                const pwm = parseFloat(controlVal.toFixed(3));
                const cpuTemp = 40 + controlVal * 20 + noise(2);
                const current = 0.05 + controlVal * 0.1;

                comp.outputs['gpio_out'] = controlVal > 0.5 ? 1 : 0;
                comp.outputs['pwm_out'] = pwm;
                comp.outputs['serial_out'] = parseFloat(cpuTemp.toFixed(1));
                comp.outputs['data_out'] = parseFloat(controlVal.toFixed(3));

                return [
                    { metric: 'cpu_temp', value: parseFloat(cpuTemp.toFixed(1)) },
                    { metric: 'current', value: parseFloat(current.toFixed(3)) },
                    { metric: 'pwm_output', value: pwm },
                ];
            }

            case 'PLCController': {
                if (hasFailed || !hasPower) {
                    comp.outputs['control_out'] = null; comp.outputs['data_out'] = null;
                    return [];
                }
                const analogIn = comp.inputs['analog_in'] ?? 0;
                const digitalIn = comp.inputs['digital_in'] ?? 0;
                comp.internal.scan++;

                // Ladder logic: if analog threshold exceeded, activate control
                const controlActive = analogIn > 30 || digitalIn > 0 ? 1 : 0;
                comp.outputs['control_out'] = controlActive;
                comp.outputs['data_out'] = analogIn;
                return [
                    { metric: 'control_output', value: controlActive },
                    { metric: 'scan_count', value: comp.internal.scan },
                ];
            }

            // ── ACTUATORS ───────────────────────────
            case 'MotorPump': {
                const overloadScenario = scenarios.find(s => s.type === 'motor_overload');
                const ctrlIn = comp.inputs['ctrl_in'] ?? 0;

                if (!hasPower || hasFailed) {
                    comp.internal.state = 'OFF'; comp.internal.rpm = 0;
                    comp.outputs['status_out'] = 0;
                    return [{ metric: 'current', value: 0 }, { metric: 'rpm', value: 0 }];
                }

                const maxRPM = comp.params.maxRPM || 3000;

                if (overloadScenario) {
                    comp.internal.state = 'OVERLOADED';
                    comp.internal.heatLevel = Math.min(100, comp.internal.heatLevel + overloadScenario.severity * 5);
                    const current = 5.0 + overloadScenario.severity * 10;
                    comp.outputs['status_out'] = 2; // overloaded flag
                    return [
                        { metric: 'current', value: parseFloat(current.toFixed(2)) },
                        { metric: 'rpm', value: comp.internal.rpm },
                        { metric: 'heat', value: comp.internal.heatLevel },
                    ];
                }

                if (typeof ctrlIn === 'number' && ctrlIn > 0) {
                    comp.internal.state = 'ON';
                    comp.internal.rpm = parseFloat((ctrlIn * maxRPM).toFixed(0));
                    comp.internal.heatLevel = Math.max(0, comp.internal.heatLevel - 0.5);
                } else {
                    comp.internal.state = 'OFF';
                    comp.internal.rpm = Math.max(0, comp.internal.rpm - 200);
                    comp.internal.heatLevel = Math.max(0, comp.internal.heatLevel - 1);
                }

                const motorCurrent = comp.internal.rpm > 0
                    ? 0.5 + (comp.internal.rpm / maxRPM) * 1.5 + noise(0.05)
                    : 0.01;
                comp.outputs['status_out'] = comp.internal.state === 'ON' ? 1 : 0;

                return [
                    { metric: 'current', value: parseFloat(motorCurrent.toFixed(3)) },
                    { metric: 'rpm', value: comp.internal.rpm },
                ];
            }

            case 'Relay': {
                const coilIn = comp.inputs['ctrl_in'] ?? 0;
                if (!hasPower || hasFailed) {
                    comp.internal.closed = false;
                    comp.outputs['switch_out'] = null;
                    return [{ metric: 'state', value: 0 }];
                }
                comp.internal.closed = coilIn > 0;
                comp.outputs['switch_out'] = comp.internal.closed ? powerIn : null;
                return [{ metric: 'state', value: comp.internal.closed ? 1 : 0 }];
            }

            // ── COMMUNICATION ───────────────────────
            case 'WiFiModule': {
                if (!hasPower || hasFailed) {
                    comp.outputs['wifi_out'] = null;
                    return [{ metric: 'latency', value: 0 }];
                }
                const delayScenario = scenarios.find(s => s.type === 'network_delay');
                const dataIn = comp.inputs['data_in'] ?? null;
                const baseLat = comp.params.latencyMs || 50;
                const extraLat = delayScenario ? delayScenario.severity * 500 : 0;
                const latency = baseLat + extraLat + noise(5);
                comp.outputs['wifi_out'] = dataIn;
                comp.internal.latency = latency;
                return [
                    { metric: 'latency', value: parseFloat(latency.toFixed(1)) },
                    { metric: 'rssi', value: parseFloat((-50 + noise(10)).toFixed(0)) },
                ];
            }

            case 'BluetoothModule': {
                if (!hasPower || hasFailed) { comp.outputs['bt_out'] = null; return []; }
                const dataIn = comp.inputs['data_in'] ?? null;
                comp.outputs['bt_out'] = dataIn;
                return [{ metric: 'rssi', value: parseFloat((-40 + noise(8)).toFixed(0)) }];
            }

            // ── PROCESSING ──────────────────────────
            case 'EdgeProcessor': {
                if (!hasPower || hasFailed) {
                    comp.outputs['data_out'] = null; comp.outputs['control_out'] = null;
                    return [];
                }
                const dataIn = comp.inputs['data_in'] ?? 0;
                // Simple anomaly detection: rolling average deviation
                const prev = comp.internal.anomalyScore || 0;
                const deviation = Math.abs(dataIn - prev);
                comp.internal.anomalyScore = parseFloat((prev * 0.9 + dataIn * 0.1).toFixed(3));
                const isAnomaly = deviation > 10 ? 1 : 0;
                comp.outputs['data_out'] = dataIn;
                comp.outputs['control_out'] = isAnomaly;
                return [
                    { metric: 'anomaly_score', value: parseFloat(deviation.toFixed(2)) },
                    { metric: 'cpu_util', value: parseFloat((30 + Math.random() * 40).toFixed(1)) },
                ];
            }

            default:
                return [{ metric: 'value', value: parseFloat((Math.random() * 100).toFixed(2)) }];
        }
    }
}
