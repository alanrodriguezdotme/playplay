import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** Parse the settings JSON string from a venue record */
export function parseSettings(settings: string | unknown): Record<string, unknown> {
    if (typeof settings === "string") {
        try { return JSON.parse(settings); } catch { return {}; }
    }
    if (settings && typeof settings === "object") return settings as Record<string, unknown>;
    return {};
}

/** Stringify settings for storage */
export function stringifySettings(settings: Record<string, unknown>): string {
    return JSON.stringify(settings);
}
