// Shared username validation. Used by both the web client (for inline
// feedback / toast errors) and the server (as the source of truth).
//
// Rules:
//  - 1–30 characters after trim
//  - Only A–Z, a–z, 0–9, ".", "_", "-"
//  - No spaces, no emoji, no punctuation outside the allowed set
//  - Rejects a small list of obvious profanity / slurs (after light
//    leet-speak normalization). Keep PROFANITY_STEMS short and obvious;
//    this is a basic filter, not a full moderation system.

export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_REGEX = /^[A-Za-z0-9._-]+$/;

// Stems matched as substrings against the normalized username.
// Add or remove as needed. Kept intentionally small and uncontroversial.
const PROFANITY_STEMS: readonly string[] = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "dick",
  "pussy",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "kike",
  "spic",
  "chink",
  "tranny",
  "whore",
  "slut",
];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((c) => LEET_MAP[c] ?? c)
    .join("")
    .replace(/[._-]/g, "");
}

export type UsernameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function validateUsername(raw: unknown): UsernameValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Username is required." };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Username can't be empty." };
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      ok: false,
      reason:
        "Use only letters, numbers, dots, dashes, and underscores — no spaces or emoji.",
    };
  }
  const normalized = normalize(trimmed);
  for (const stem of PROFANITY_STEMS) {
    if (normalized.includes(stem)) {
      return { ok: false, reason: "That username isn't allowed." };
    }
  }
  return { ok: true, value: trimmed };
}
