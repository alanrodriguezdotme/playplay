import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";
const APP_SALT = "playplay-venue:secrets:v1";
const KEY_INFO = "spotify-credentials";

let cachedKey: Buffer | null = null;
let cachedSecret: string | null = null;

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set; cannot encrypt or decrypt stored secrets."
    );
  }
  if (cachedKey && cachedSecret === secret) return cachedKey;
  const ikm = Buffer.from(secret, "utf8");
  const derived = hkdfSync("sha256", ikm, Buffer.from(APP_SALT), Buffer.from(KEY_INFO), 32);
  cachedKey = Buffer.from(derived);
  cachedSecret = secret;
  return cachedKey;
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognized secret format");
  }
  const key = getKey();
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

export function tryDecryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    return decryptSecret(blob);
  } catch {
    return null;
  }
}
