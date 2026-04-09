import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const SERVER = join(ROOT, "packages", "server");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const ENV_TARGET = join(SERVER, ".env");

// 1. Create .env from .env.example if it doesn't exist
if (!existsSync(ENV_TARGET)) {
    console.log("Creating packages/server/.env from .env.example...");
    let env = readFileSync(ENV_EXAMPLE, "utf-8");
    // Generate a random JWT secret
    const secret = randomBytes(32).toString("base64url");
    env = env.replace(
        /JWT_SECRET="[^"]*"/,
        `JWT_SECRET="${secret}"`,
    );
    writeFileSync(ENV_TARGET, env);
    console.log("  .env created with a random JWT_SECRET.");
} else {
    console.log("packages/server/.env already exists, skipping.");
}

// 2. Generate Prisma client
console.log("\nGenerating Prisma client...");
execSync("npx prisma generate", { cwd: SERVER, stdio: "inherit" });

// 3. Run migrations
console.log("\nRunning database migrations...");
execSync("npx prisma migrate dev --skip-generate", {
    cwd: SERVER,
    stdio: "inherit",
});

// 4. Seed (only if DB was just created — prisma migrate dev auto-seeds on first run)
console.log("\nSetup complete! Run `pnpm dev` to start.");
