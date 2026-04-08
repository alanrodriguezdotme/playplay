import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { generateOtp, verifyOtp, signToken } from "../services/auth.js";
import { authenticate } from "../middleware/auth.js";
import type { UserProfile } from "@playplay/shared";

const router = Router();

// POST /api/auth/request-otp
router.post("/request-otp", async (req, res) => {
  const { phone, venueSlug, email } = req.body;

  if (!phone || !venueSlug) {
    res.status(400).json({ error: "BAD_REQUEST", message: "phone and venueSlug are required" });
    return;
  }

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    return;
  }

  // Admin path: verify email matches venue email
  const isAdmin = !!email;
  if (isAdmin && venue.email !== email) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid venue email" });
    return;
  }

  generateOtp(phone, venue.id, isAdmin);

  res.json({ message: "OTP sent" });
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  const { phone, code, venueSlug } = req.body;

  if (!phone || !code || !venueSlug) {
    res.status(400).json({ error: "BAD_REQUEST", message: "phone, code, and venueSlug are required" });
    return;
  }

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    return;
  }

  const otpEntry = verifyOtp(phone, code);
  if (!otpEntry) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired OTP" });
    return;
  }

  if (otpEntry.venueId !== venue.id) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "OTP venue mismatch" });
    return;
  }

  const role = otpEntry.isAdmin ? "ADMIN" : "PATRON";

  const user = await prisma.user.upsert({
    where: { phone_venueId: { phone, venueId: venue.id } },
    create: { phone, venueId: venue.id, role },
    update: { role },
  });

  if (user.blocked) {
    res.status(403).json({ error: "FORBIDDEN", message: "User is blocked" });
    return;
  }

  const token = signToken({ userId: user.id, venueId: venue.id, role: user.role });

  const userProfile: UserProfile = {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role as UserProfile["role"],
    venueId: user.venueId,
    isBlocked: user.blocked,
  };

  res.json({ token, user: userProfile });
});

// POST /api/auth/set-display-name
router.post("/set-display-name", authenticate, async (req, res) => {
  const { displayName } = req.body;

  if (!displayName || typeof displayName !== "string" || displayName.trim().length === 0) {
    res.status(400).json({ error: "BAD_REQUEST", message: "displayName is required" });
    return;
  }

  if (displayName.trim().length > 30) {
    res.status(400).json({ error: "BAD_REQUEST", message: "displayName must be 30 characters or less" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { displayName: displayName.trim() },
  });

  const userProfile: UserProfile = {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    role: user.role as UserProfile["role"],
    venueId: user.venueId,
    isBlocked: user.blocked,
  };

  res.json(userProfile);
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

export default router;
