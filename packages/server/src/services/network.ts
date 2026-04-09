import { networkInterfaces } from "node:os";

export function getLocalIp(): string | null {
    const nets = networkInterfaces();
    for (const entries of Object.values(nets)) {
        if (!entries) continue;
        for (const entry of entries) {
            if (entry.family === "IPv4" && !entry.internal) {
                return entry.address;
            }
        }
    }
    return null;
}
