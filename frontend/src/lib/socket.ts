import { io } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

export const socket = io(WS_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 10000,
});

const joinedSystems = new Set<string>();

function rejoinAllRooms() {
    joinedSystems.forEach((systemId) => {
        socket.emit("join_system", systemId);
    });
}

socket.on("connect", () => {
    rejoinAllRooms();
});

export function joinSystemRoom(systemId: string) {
    if (!systemId) return;
    joinedSystems.add(systemId);
    if (socket.connected) {
        socket.emit("join_system", systemId);
    }
}

export function leaveSystemRoom(systemId: string) {
    if (!systemId) return;
    joinedSystems.delete(systemId);
    if (socket.connected) {
        socket.emit("leave_system", systemId);
    }
}

export function getSocketConnectionState() {
    return socket.connected;
}
