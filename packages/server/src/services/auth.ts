import jwt from "jsonwebtoken";
import crypto from "crypto";
import { DEFAULTS } from "@playplay/shared";

// ---- OTP Store ----

interface OtpEntry {
  code: string;
  expiresAt: number;
  venueId: string;
  isAdmin: boolean;
}

const otpStore = new Map<string, OtpEntry>();

export function generateOtp(
  phone: string,
  venueId: string,
  isAdmin: boolean
): string {
  const code = crypto.randomInt(100000, 999999).toString();
  const ttl = Number(process.env.OTP_TTL_SECONDS) || DEFAULTS.OTP_TTL_SECONDS;
  const expiresAt = Date.now() + ttl * 1000;

  otpStore.set(phone, { code, expiresAt, venueId, isAdmin });

  console.log(`[OTP] ${phone}: ${code} (expires in ${ttl}s)`);
  return code;
}

export function verifyOtp(
  phone: string,
  code: string
): OtpEntry | null {
  const entry = otpStore.get(phone);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return null;
  }
  if (entry.code !== code) return null;

  otpStore.delete(phone);
  return entry;
}

// Clean up expired OTPs every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of otpStore) {
    if (now > entry.expiresAt) {
      otpStore.delete(phone);
    }
  }
}, 60_000);

// ---- Venue Display Code (rotating, venue-wide) ----

interface VenueCode {
  code: string;
  expiresAt: number;
}

const venueCodeStore = new Map<string, VenueCode>();

const VENUE_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getVenueCode(venueId: string): { code: string; expiresAt: number } {
  const existing = venueCodeStore.get(venueId);
  if (existing && Date.now() < existing.expiresAt) {
    return existing;
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + VENUE_CODE_TTL_MS;
  const entry = { code, expiresAt };
  venueCodeStore.set(venueId, entry);
  console.log(`[VENUE CODE] Venue ${venueId}: ${code} (expires in 5m)`);
  return entry;
}

export function verifyVenueCode(venueId: string, code: string): boolean {
  const entry = venueCodeStore.get(venueId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    venueCodeStore.delete(venueId);
    return false;
  }
  return entry.code === code;
}

// ---- JWT ----

interface TokenPayload {
  userId: string;
  venueId: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.verify(token, secret) as TokenPayload;
}
