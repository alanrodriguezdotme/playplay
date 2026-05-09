// Seed is intentionally a no-op. The first-run wizard (`pnpm setup`) creates
// the venue + admin via packages/server/src/scripts/firstRun.ts. This file
// exists only because Prisma references a "seed" script in package.json.
console.log("(seed: no-op — run `pnpm setup` for first-run configuration)");
