import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.js";
import { prisma } from "../lib/prisma.js";
import type { UserProfile } from "@playplay/shared";

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Missing token" });
    return;
  }

  const token = header.slice(7);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "User not found" });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: "FORBIDDEN", message: "User is blocked" });
    return;
  }

  req.user = {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role as UserProfile["role"],
    venueId: user.venueId,
    isBlocked: user.blocked,
  };

  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" });
    return;
  }
  next();
}
