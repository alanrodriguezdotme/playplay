import { describe, it, expect } from "vitest";
import { buildMergedVenueSettings } from "../src/lib/venueSettingsUpdate";

/**
 * Regression guard for the bug where saving any venue setting wiped the stored
 * Spotify dev credentials (GitHub issues #6, #7, #8, #9). The merge must be based
 * on the RAW stored settings so private fields the public view omits survive.
 */
describe("buildMergedVenueSettings", () => {
  const rawWithCreds = () => ({
    voteThreshold: -5,
    maxSongsPerUser: 3,
    spotify: {
      clientIdEnc: "v1:encrypted-client-id",
      clientSecretEnc: "v1:encrypted-client-secret",
      relayUrl: "https://relay.example.com",
    },
  });

  it("preserves encrypted Spotify credentials when changing maxSongsPerUser (issue #8)", () => {
    const result = buildMergedVenueSettings(rawWithCreds(), { maxSongsPerUser: 5 });
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.merged.maxSongsPerUser).toBe(5);
    const spotify = result.merged.spotify as Record<string, unknown>;
    expect(spotify.clientIdEnc).toBe("v1:encrypted-client-id");
    expect(spotify.clientSecretEnc).toBe("v1:encrypted-client-secret");
    expect(spotify.relayUrl).toBe("https://relay.example.com");
  });

  it("preserves credentials and all unrelated raw fields when changing an arbitrary setting", () => {
    const result = buildMergedVenueSettings(rawWithCreds(), { voteThreshold: -10 });
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.merged.voteThreshold).toBe(-10);
    // Unchanged field carried over verbatim from raw.
    expect(result.merged.maxSongsPerUser).toBe(3);
    const spotify = result.merged.spotify as Record<string, unknown>;
    expect(spotify.clientIdEnc).toBe("v1:encrypted-client-id");
    expect(spotify.clientSecretEnc).toBe("v1:encrypted-client-secret");
  });

  it("does not mutate the input raw object", () => {
    const raw = rawWithCreds();
    buildMergedVenueSettings(raw, { maxSongsPerUser: 9 });
    expect(raw.maxSongsPerUser).toBe(3);
  });

  it("returns a validation error without touching credentials on bad input", () => {
    const result = buildMergedVenueSettings(rawWithCreds(), { maxSongsPerUser: 0 });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error.status).toBe(400);
    expect(result.error.code).toBe("validation");
  });
});
