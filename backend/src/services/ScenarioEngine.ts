/**
 * ScenarioEngine — manages active failure/event scenarios.
 * Scenarios modify component behavior during simulation ticks.
 */

export type ScenarioType =
    | 'sensor_failure'
    | 'signal_noise'
    | 'voltage_drop'
    | 'motor_overload'
    | 'network_delay'
    | 'component_overheat';

export interface Scenario {
    id: string;
    type: ScenarioType;
    targetComponentId: string;
    severity: number;           // 0.0–1.0
    startTick: number;
    durationTicks: number;      // -1 = permanent
    params: Record<string, any>;
}

export class ScenarioEngine {
    private scenarios: Map<string, Map<string, Scenario>> = new Map(); // systemId → Map<scenarioId, Scenario>

    /** Inject a new scenario into a running simulation */
    inject(systemId: string, scenario: Omit<Scenario, 'id'>): Scenario {
        if (!this.scenarios.has(systemId)) this.scenarios.set(systemId, new Map());
        const id = `scn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const full: Scenario = { ...scenario, id };
        this.scenarios.get(systemId)!.set(id, full);
        console.log(`[ScenarioEngine] Injected ${scenario.type} on ${scenario.targetComponentId} (severity=${scenario.severity})`);
        return full;
    }

    /** Remove a specific scenario */
    remove(systemId: string, scenarioId: string): boolean {
        const map = this.scenarios.get(systemId);
        if (!map) return false;
        const removed = map.delete(scenarioId);
        if (removed) console.log(`[ScenarioEngine] Removed scenario ${scenarioId}`);
        return removed;
    }

    /** Clear all scenarios for a system */
    clearAll(systemId: string) {
        this.scenarios.delete(systemId);
    }

    /** List active scenarios for a system */
    list(systemId: string): Scenario[] {
        const map = this.scenarios.get(systemId);
        return map ? Array.from(map.values()) : [];
    }

    /**
     * Get active scenarios for a specific component at the given tick.
     * Automatically removes expired scenarios.
     */
    getActiveForComponent(systemId: string, componentId: string, currentTick: number): Scenario[] {
        const map = this.scenarios.get(systemId);
        if (!map) return [];

        const active: Scenario[] = [];
        for (const [id, scn] of map) {
            // Check expiry
            if (scn.durationTicks > 0 && currentTick >= scn.startTick + scn.durationTicks) {
                map.delete(id); // Expired — auto-remove
                console.log(`[ScenarioEngine] Scenario ${id} expired`);
                continue;
            }
            // Check if started
            if (currentTick < scn.startTick) continue;
            // Check target
            if (scn.targetComponentId === componentId) {
                active.push(scn);
            }
        }
        return active;
    }
}
