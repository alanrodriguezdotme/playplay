import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[Error]", err.message);

  if (err.name === "JsonWebTokenError") {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Token expired" });
    return;
  }

  res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
}
