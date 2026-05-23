#!/usr/bin/env node
// PlayPlay — First-Run Setup Wizard
//
// Designed to run on a freshly-cloned repo with only Node installed:
//   node scripts/setup.mjs
//
// Subsequent runs are idempotent — pass --reconfigure to re-prompt.
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { tmpdir, networkInterfaces } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolvePath(dirname(__filename), "..");
const SERVER_DIR = join(ROOT, "packages", "server");
const ENV_TARGET = join(SERVER_DIR, ".env");
const ENV_EXAMPLE = join(SERVER_DIR, ".env.example");
const STAMP = join(SERVER_DIR, ".playplay-configured");
const LAUNCHERS_DIR = join(ROOT, "scripts", "launchers");
const DEFAULT_RELAY_URL = "https://spotify-relay.vercel.app";

const args = new Set(process.argv.slice(2));
const RECONFIGURE = args.has("--reconfigure");
const NO_START = args.has("--no-start");

// ---------- prerequisite checks ----------

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isNaN(major) || major < 20) {
    console.error(`PlayPlay needs Node.js 20 or newer. You have ${process.version}.`);
    console.error("Install:");
    console.error("  macOS:    brew install node");
    console.error("  Windows:  winget install OpenJS.NodeJS.LTS");
    console.error("  Linux:    https://nodejs.org/  (or your distro's package manager)");
    process.exit(1);
  }
}

function which(cmd) {
  const isWin = process.platform === "win32";
  const result = spawnSync(isWin ? "where" : "which", [cmd], { encoding: "utf-8" });
  return result.status === 0 && (result.stdout ?? "").trim().length > 0;
}

function ensurePnpm() {
  if (which("pnpm")) return;
  console.log("pnpm not found — bootstrapping via corepack...");
  try {
    execSync("corepack enable", { stdio: "inherit" });
    execSync("corepack prepare pnpm@latest --activate", { stdio: "inherit" });
  } catch {
    console.error("\nCould not enable pnpm via corepack.");
    console.error("Try installing manually: npm install --global pnpm");
    process.exit(1);
  }
}

function ensureInstalled() {
  const nm = join(ROOT, "node_modules");
  if (existsSync(nm)) return;
  console.log("Installing dependencies (first run)...\n");
  execSync("pnpm install --frozen-lockfile", { cwd: ROOT, stdio: "inherit" });
}

// ---------- helpers ----------

function lanAddresses() {
  const out = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "my-venue"
  );
}

function upsertEnvLine(content, key, value) {
  const line = `${key}="${value}"`;
  // Match lines like `KEY=...` or `KEY="..."` (with optional surrounding whitespace).
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return (content.endsWith("\n") || content.length === 0 ? content : content + "\n") + line + "\n";
}

function writeEnvFile({ port, musicLibraryPath }) {
  let env;
  if (existsSync(ENV_TARGET)) {
    env = readFileSync(ENV_TARGET, "utf-8");
  } else {
    env = readFileSync(ENV_EXAMPLE, "utf-8");
    const secret = randomBytes(32).toString("base64url");
    env = env.replace(/JWT_SECRET="[^"]*"/, `JWT_SECRET="${secret}"`);
  }
  // Always update the user-driven values from the wizard.
  env = upsertEnvLine(env, "PORT", String(port));
  env = upsertEnvLine(env, "MUSIC_LIBRARY_PATH", musicLibraryPath);
  // Make sure JWT_SECRET exists and isn't the placeholder, even in pre-existing .envs.
  if (/JWT_SECRET="change-me-to-a-random-secret"/.test(env) || !/JWT_SECRET=".+"/.test(env)) {
    const secret = randomBytes(32).toString("base64url");
    env = upsertEnvLine(env, "JWT_SECRET", secret);
  }
  writeFileSync(ENV_TARGET, env);
}

function makeLaunchersExecutable() {
  if (process.platform === "win32") return;
  if (!existsSync(LAUNCHERS_DIR)) return;
  for (const f of ["setup.command", "start.command", "setup.sh", "start.sh"]) {
    const p = join(LAUNCHERS_DIR, f);
    if (existsSync(p)) {
      try { chmodSync(p, 0o755); } catch { /* ignore */ }
    }
  }
}

function isAppBuilt() {
  return existsSync(join(SERVER_DIR, "dist", "index.js"));
}

function isConfigured() {
  // The stamp file alone is not enough — it has historically leaked into the
  // repo, and a real install also has an .env with DATABASE_URL / JWT_SECRET.
  return existsSync(STAMP) && existsSync(ENV_TARGET);
}

function runMigrateAndBuild() {
  execSync("pnpm exec prisma migrate deploy", { cwd: SERVER_DIR, stdio: "inherit" });
  execSync("pnpm exec prisma generate", { cwd: SERVER_DIR, stdio: "inherit" });
  // Use the root `build` script so the shared package is compiled before
  // server/web. Calling `pnpm -r build` runs them in parallel and races.
  execSync("pnpm run build", { cwd: ROOT, stdio: "inherit" });
}

// ---------- main ----------

async function main() {
  checkNodeVersion();
  ensurePnpm();
  ensureInstalled();

  if (isConfigured() && !RECONFIGURE) {
    if (!isAppBuilt()) {
      console.log("PlayPlay is configured but the app isn't built yet. Building now...\n");
      try {
        runMigrateAndBuild();
      } catch (err) {
        console.error("\nBuild failed. See the output above for details.");
        process.exit(1);
      }
      console.log("\nBuild complete.");
    } else {
      console.log("PlayPlay is already configured. Pass --reconfigure to re-run setup.");
    }
    if (!NO_START) await startServer();
    return;
  }

  // If a stale stamp exists from an old clone but there's no .env, treat this
  // as a fresh install and continue with the full wizard.
  if (existsSync(STAMP) && !existsSync(ENV_TARGET)) {
    try { unlinkSync(STAMP); } catch { /* ignore */ }
  }

  // Dynamic imports — deps are now installed.
  const p = await import("@clack/prompts");
  const qrcode = (await import("qrcode-terminal")).default;

  p.intro("PlayPlay — First-Run Setup");

  const venueName = await p.text({
    message: "Venue name",
    placeholder: "My Venue",
    initialValue: "My Venue",
    validate: (v) => (v && v.trim().length > 0 ? undefined : "Required"),
  });
  if (p.isCancel(venueName)) return p.cancel("Setup cancelled.");

  const venueSlug = await p.text({
    message: "Venue slug (used in URLs)",
    initialValue: slugify(venueName),
    validate: (v) => (/^[a-z0-9-]+$/.test(v) ? undefined : "Lowercase letters, digits, dashes only"),
  });
  if (p.isCancel(venueSlug)) return p.cancel("Setup cancelled.");

  const adminEmail = await p.text({
    message: "Admin email",
    placeholder: "you@example.com",
    validate: (v) => (/.+@.+\..+/.test(v) ? undefined : "Enter a valid email"),
  });
  if (p.isCancel(adminEmail)) return p.cancel("Setup cancelled.");

  const adminPassword = await p.password({
    message: "Admin password (8+ chars)",
    validate: (v) => (v && v.length >= 8 ? undefined : "At least 8 characters"),
  });
  if (p.isCancel(adminPassword)) return p.cancel("Setup cancelled.");

  const adminPasswordConfirm = await p.password({
    message: "Confirm admin password",
    validate: (v) => (v === adminPassword ? undefined : "Passwords do not match"),
  });
  if (p.isCancel(adminPasswordConfirm)) return p.cancel("Setup cancelled.");

  const musicSource = await p.select({
    message: "Music source",
    options: [
      { value: "local", label: "Local folder", hint: "Drop MP3s in a directory; works fully offline." },
      { value: "spotify", label: "Spotify", hint: "Requires a free Spotify Developer account AND Spotify Premium for playback." },
      { value: "skip", label: "Skip for now", hint: "Configure later in Admin Settings." },
    ],
    initialValue: "local",
  });
  if (p.isCancel(musicSource)) return p.cancel("Setup cancelled.");

  let musicLibraryPath = "./music";
  if (musicSource === "local") {
    const path = await p.text({
      message: "Music library path",
      initialValue: "./music",
    });
    if (p.isCancel(path)) return p.cancel("Setup cancelled.");
    musicLibraryPath = path;
    const absolute = resolvePath(ROOT, path);
    if (!existsSync(absolute)) {
      try {
        mkdirSync(absolute, { recursive: true });
        p.log.info(`Created ${absolute}`);
      } catch (err) {
        p.log.warn(`Could not create ${absolute}: ${err.message}`);
      }
    }
  }

  const port = await p.text({
    message: "HTTP port",
    initialValue: "3001",
    validate: (v) => (/^\d+$/.test(v) && Number(v) > 0 && Number(v) < 65536 ? undefined : "1–65535"),
  });
  if (p.isCancel(port)) return p.cancel("Setup cancelled.");

  let spotifyCreds = undefined;
  if (musicSource === "spotify") {
    const relayUrl = DEFAULT_RELAY_URL;
    p.note(
      [
        "Spotify needs a free developer app:",
        "  1. Open https://developer.spotify.com/dashboard",
        "  2. Click 'Create app' (any name + description; website can be blank).",
        "  3. Add this exact Redirect URI to the app:",
        `       ${relayUrl}`,
        "  4. Save, then copy the Client ID and Client Secret.",
      ].join("\n"),
      "Spotify setup",
    );

    const wantNow = await p.confirm({
      message: "Paste Spotify credentials now?",
      initialValue: true,
    });
    if (p.isCancel(wantNow)) return p.cancel("Setup cancelled.");

    if (wantNow) {
      const clientId = await p.text({
        message: "Spotify Client ID",
        validate: (v) => (v && v.trim().length > 0 ? undefined : "Required"),
      });
      if (p.isCancel(clientId)) return p.cancel("Setup cancelled.");

      const clientSecret = await p.password({
        message: "Spotify Client Secret",
        validate: (v) => (v && v.trim().length > 0 ? undefined : "Required"),
      });
      if (p.isCancel(clientSecret)) return p.cancel("Setup cancelled.");

      spotifyCreds = { clientId: clientId.trim(), clientSecret: clientSecret.trim(), relayUrl };
    } else {
      p.log.info("Skipped — add credentials later in Admin Settings.");
    }
  }

  // ---------- write .env, build, migrate, apply config ----------
  writeEnvFile({ port, musicLibraryPath });

  const spinner = p.spinner();
  spinner.start("Running database migrations");
  try {
    execSync("pnpm exec prisma migrate deploy", { cwd: SERVER_DIR, stdio: "pipe" });
    execSync("pnpm exec prisma generate", { cwd: SERVER_DIR, stdio: "pipe" });
  } catch (err) {
    spinner.stop("Migration failed");
    console.error(err.stdout?.toString() ?? err.message);
    process.exit(1);
  }
  spinner.stop("Database ready");

  spinner.start("Building app");
  try {
    execSync("pnpm run build", { cwd: ROOT, stdio: "pipe" });
  } catch (err) {
    spinner.stop("Build failed");
    console.error(err.stdout?.toString() ?? err.message);
    process.exit(1);
  }
  spinner.stop("Build complete");

  spinner.start("Applying first-run configuration");
  const answers = {
    venueName: venueName.trim(),
    venueSlug: venueSlug.trim(),
    adminEmail: adminEmail.trim(),
    adminPassword,
    musicSource,
    musicLibraryPath: musicSource === "local" ? musicLibraryPath : undefined,
    spotify: spotifyCreds,
  };
  const answersFile = join(tmpdir(), `playplay-answers-${Date.now()}.json`);
  writeFileSync(answersFile, JSON.stringify(answers), { mode: 0o600 });
  try {
    const firstRunJs = join(SERVER_DIR, "dist", "scripts", "firstRun.js");
    execSync(`node ${JSON.stringify(firstRunJs)} ${JSON.stringify(answersFile)}`, {
      cwd: SERVER_DIR,
      stdio: "pipe",
    });
  } catch (err) {
    spinner.stop("First-run configuration failed");
    console.error(err.stdout?.toString() ?? err.message);
    process.exit(1);
  } finally {
    try { unlinkSync(answersFile); } catch { /* ignore */ }
  }
  spinner.stop("Configuration applied");

  writeFileSync(STAMP, new Date().toISOString());
  makeLaunchersExecutable();

  // ---------- success banner ----------
  const portNum = Number(port);
  const ips = ["127.0.0.1", ...lanAddresses()];
  const primary = lanAddresses()[0] || "127.0.0.1";
  const patronUrl = `http://${primary}:${portNum}/`;

  p.outro("Setup complete.");
  console.log("");
  console.log("Reachable at:");
  for (const ip of ips) console.log(`  http://${ip}:${portNum}`);
  console.log("");
  console.log("  Admin:    /admin");
  console.log("  Patron:   /        (share this URL or scan the QR below)");
  console.log("  Display:  /now-playing");
  console.log("");
  console.log(`Patron URL: ${patronUrl}`);
  qrcode.generate(patronUrl, { small: true });
  console.log("");
  console.log("Re-run setup: pnpm setup --reconfigure");
  console.log("Just start:   pnpm start  (or double-click scripts/launchers/start.*)");
  console.log("");

  if (!NO_START) {
    const startNow = await p.confirm({ message: "Start the server now?", initialValue: true });
    if (!p.isCancel(startNow) && startNow) await startServer();
  }
}

async function startServer() {
  const entry = join(SERVER_DIR, "dist", "index.js");
  if (!existsSync(entry)) {
    console.log("App isn't built yet. Building now...\n");
    try {
      runMigrateAndBuild();
    } catch (err) {
      console.error("\nBuild failed. See the output above for details.");
      process.exit(1);
    }
    console.log("\nBuild complete.");
  }
  const child = spawnSync(process.execPath, [entry], { cwd: ROOT, stdio: "inherit" });
  if (child.status !== 0) process.exit(child.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
