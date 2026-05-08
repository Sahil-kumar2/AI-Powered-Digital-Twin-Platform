import type { Node, Edge } from "reactflow";
import type { BuilderNodeData } from "./builderStore";
import { getTemplate, areSignalsCompatible } from "./componentLibrary";

export interface ValidationMessage {
    level: "error" | "warning" | "info";
    nodeId?: string;
    message: string;
}

export function validateSystem(
    nodes: Node<BuilderNodeData>[],
    edges: Edge[]
): ValidationMessage[] {
    const messages: ValidationMessage[] = [];

    if (nodes.length === 0) {
        messages.push({ level: "error", message: "System has no components. Add at least one component." });
        return messages;
    }

    // 1. Check each node has a template
    for (const node of nodes) {
        const template = getTemplate(node.data.componentType);
        if (!template) {
            messages.push({ level: "error", nodeId: node.id, message: `Unknown component type: ${node.data.componentType}` });
            continue;
        }

        // 2. Check required input ports are connected
        const inputPorts = template.ports.filter((p) => p.direction === "input");
        for (const port of inputPorts) {
            const hasConnection = edges.some(
                (e) => e.target === node.id && e.targetHandle === port.id
            );
            if (!hasConnection) {
                const isPower = port.signalType === "power_dc" || port.signalType === "power_ac";
                messages.push({
                    level: isPower ? "warning" : "info",
                    nodeId: node.id,
                    message: `${node.data.label}: "${port.label}" port has no connection${isPower ? " — component may not be powered" : ""}`,
                });
            }
        }

        // 3. Check components with no output connections (dead-ends)
        const outputPorts = template.ports.filter((p) => p.direction === "output");
        const hasAnyOutputConnected = outputPorts.some((port) =>
            edges.some((e) => e.source === node.id && e.sourceHandle === port.id)
        );
        if (!hasAnyOutputConnected && outputPorts.length > 0) {
            messages.push({
                level: "info",
                nodeId: node.id,
                message: `${node.data.label}: No output connections — signals will not propagate.`,
            });
        }
    }

    // 4. Validate edge signal compatibility
    for (const edge of edges) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (!sourceNode || !targetNode) continue;

        const sourceTemplate = getTemplate(sourceNode.data.componentType);
        const targetTemplate = getTemplate(targetNode.data.componentType);
        if (!sourceTemplate || !targetTemplate) continue;

        const sourcePort = sourceTemplate.ports.find((p) => p.id === edge.sourceHandle);
        const targetPort = targetTemplate.ports.find((p) => p.id === edge.targetHandle);
        if (!sourcePort || !targetPort) continue;

        if (!areSignalsCompatible(sourcePort.signalType, targetPort.signalType)) {
            messages.push({
                level: "error",
                nodeId: edge.source,
                message: `Signal mismatch: ${sourceNode.data.label}.${sourcePort.label}(${sourcePort.signalType}) → ${targetNode.data.label}.${targetPort.label}(${targetPort.signalType})`,
            });
        }
    }

    // 5. Check for isolated components (no connections at all)
    for (const node of nodes) {
        const hasAnyEdge = edges.some((e) => e.source === node.id || e.target === node.id);
        if (!hasAnyEdge) {
            messages.push({
                level: "warning",
                nodeId: node.id,
                message: `${node.data.label}: Component is completely isolated with no connections.`,
            });
        }
    }

    // Success message
    const errorCount = messages.filter((m) => m.level === "error").length;
    const warnCount = messages.filter((m) => m.level === "warning").length;
    if (errorCount === 0 && warnCount === 0) {
        messages.push({ level: "info", message: "✓ System validation passed — ready for simulation." });
    }

    return messages;
}
