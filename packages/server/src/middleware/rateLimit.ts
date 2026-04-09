import { Request, Response, NextFunction } from "express";
import { DEFAULTS } from "@playplay/shared";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(
  maxRequests = DEFAULTS.RATE_LIMIT_MAX_REGISTRATIONS,
  windowMs = DEFAULTS.RATE_LIMIT_WINDOW_MS,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const now = Date.now();

    const entry = store.get(ip);
    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many registrations from this device. Try again later.",
      });
      return;
    }

    entry.count++;
    next();
  };
}
