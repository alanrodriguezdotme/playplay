import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma, parseSettings } from "../lib/prisma.js";
import { signToken, getVenueCode, verifyVenueCode } from "../services/auth.js";
import { authenticate } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { DEFAULTS } from "@playplay/shared";
import type { UserProfile, OtpDeliveryMode } from "@playplay/shared";

const router = Router();

function toUserProfile(user: {
  id: string;
  phone: string | null;
  deviceId: string | null;
  displayName: string | null;
  avatarEmoji: string | null;
  role: string;
  venueId: string;
  blocked: boolean;
}): UserProfile {
  return {
    id: user.id,
    phone: user.phone,
    deviceId: user.deviceId,
    displayName: user.displayName,
    avatarEmoji: user.avatarEmoji,
    role: user.role as UserProfile["role"],
    venueId: user.venueId,
    isBlocked: user.blocked,
  };
}

// ---- Device Auth ----

// POST /api/auth/register — new device registration
router.post("/register", rateLimit(), async (req, res) => {
  const { deviceId, venueSlug, displayName, avatarEmoji } = req.body;

  if (!deviceId || !venueSlug || !displayName || !avatarEmoji) {
    res.status(400).json({
      error: "BAD_REQUEST",
      message: "deviceId, venueSlug, displayName, and avatarEmoji are required",
    });
    return;
  }

  if (typeof displayName !== "string" || displayName.trim().length === 0 || displayName.trim().length > 30) {
    res.status(400).json({ error: "BAD_REQUEST", message: "displayName must be 1-30 characters" });
    return;
  }

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    return;
  }

  // Check if device already registered
  const existing = await prisma.user.findUnique({
    where: { deviceId_venueId: { deviceId, venueId: venue.id } },
  });
  if (existing) {
    res.status(409).json({ error: "CONFLICT", message: "Device already registered" });
    return;
  }

  // Check OTP delivery mode — if venue-display, require venue code
  const settings = parseSettings(venue.settings);
  const otpMode = (settings.otpDeliveryMode as OtpDeliveryMode) ?? DEFAULTS.OTP_DELIVERY_MODE;

  if (otpMode === "venue-display") {
    const { venueCode } = req.body;
    if (!venueCode) {
      res.status(400).json({
        error: "VENUE_CODE_REQUIRED",
        message: "This venue requires a code from the display screen to register.",
        requiresVenueCode: true,
      });
      return;
    }

    if (!verifyVenueCode(venue.id, venueCode)) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired venue code" });
      return;
    }
  }

  const user = await prisma.user.create({
    data: {
      deviceId,
      displayName: displayName.trim(),
      avatarEmoji,
      venueId: venue.id,
    },
  });

  const token = signToken({ userId: user.id, venueId: venue.id, role: user.role });
  res.json({ token, user: toUserProfile(user) });
});

// GET /api/auth/venue-info/:slug — public venue auth requirements
router.get("/venue-info/:slug", async (req, res) => {
  const { slug: venueSlug } = req.params;

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    return;
  }

  const settings = parseSettings(venue.settings);
  const otpMode = (settings.otpDeliveryMode as OtpDeliveryMode) ?? DEFAULTS.OTP_DELIVERY_MODE;

  res.json({ requiresVenueCode: otpMode === "venue-display" });
});

// GET /api/auth/venue-code/:slug — get current venue code for display screen
router.get("/venue-code/:slug", async (req, res) => {
  const { slug: venueSlug } = req.params;

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    return;
  }

  const settings = parseSettings(venue.settings);
  const otpMode = (settings.otpDeliveryMode as OtpDeliveryMode) ?? DEFAULTS.OTP_DELIVERY_MODE;

  if (otpMode !== "venue-display") {
    res.status(404).json({ error: "NOT_ENABLED", message: "Venue code display is not enabled" });
    return;
  }

  const { code, expiresAt } = getVenueCode(venue.id);
  res.json({ code, expiresAt });
});

// POST /api/auth/device-login — returning device
router.post("/device-login", async (req, res) => {
  const { deviceId, venueSlug } = req.body;

  if (!deviceId || !venueSlug) {
    res.status(400).json({ error: "BAD_REQUEST", message: "deviceId and venueSlug are required" });
    return;
  }

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(404).json({ error: "NOT_FOUND", message: "Venue not found" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { deviceId_venueId: { deviceId, venueId: venue.id } },
  });

  if (!user) {
    res.status(404).json({ error: "NOT_FOUND", message: "Device not registered" });
    return;
  }

  if (user.blocked) {
    res.status(403).json({ error: "FORBIDDEN", message: "User is blocked" });
    return;
  }

  const token = signToken({ userId: user.id, venueId: venue.id, role: user.role });
  res.json({ token, user: toUserProfile(user) });
});

// ---- Profile ----

// POST /api/auth/update-profile — update display name and/or avatar
router.post("/update-profile", authenticate, async (req, res) => {
  const { displayName, avatarEmoji } = req.body;

  const data: Record<string, string> = {};

  if (displayName !== undefined) {
    if (typeof displayName !== "string" || displayName.trim().length === 0 || displayName.trim().length > 30) {
      res.status(400).json({ error: "BAD_REQUEST", message: "displayName must be 1-30 characters" });
      return;
    }
    data.displayName = displayName.trim();
  }

  if (avatarEmoji !== undefined) {
    if (typeof avatarEmoji !== "string" || avatarEmoji.trim().length === 0) {
      res.status(400).json({ error: "BAD_REQUEST", message: "avatarEmoji is required" });
      return;
    }
    data.avatarEmoji = avatarEmoji.trim();
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Nothing to update" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data,
  });

  res.json(toUserProfile(user));
});

// ---- Admin Login ----

// POST /api/auth/admin-login
router.post("/admin-login", rateLimit(), async (req, res) => {
  const { email, password, venueSlug } = req.body;

  if (!email || !password || !venueSlug) {
    res.status(400).json({ error: "BAD_REQUEST", message: "email, password, and venueSlug are required" });
    return;
  }

  const venue = await prisma.venue.findUnique({ where: { slug: venueSlug } });
  if (!venue) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid email or password" });
    return;
  }

  if (venue.email !== email) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, venue.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid email or password" });
    return;
  }

  // Upsert the admin user for this venue
  let user = await prisma.user.findFirst({
    where: { venueId: venue.id, role: "ADMIN" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { venueId: venue.id, role: "ADMIN" },
    });
  }

  if (user.blocked) {
    res.status(403).json({ error: "FORBIDDEN", message: "User is blocked" });
    return;
  }

  const token = signToken({ userId: user.id, venueId: venue.id, role: user.role });
  res.json({ token, user: toUserProfile(user) });
});

// POST /api/auth/set-display-name (kept for backward compat)
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

  res.json(toUserProfile(user));
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

export default router;
