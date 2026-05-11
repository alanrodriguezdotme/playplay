import "dotenv/config";
import http from "node:http";
import os from "node:os";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import songsRouter from "./routes/songs.js";
import adminRouter from "./routes/admin.js";
import queueRouter from "./routes/queue.js";
import spotifyRouter from "./routes/spotify.js";
import { authenticate, requireAdmin } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { initSocket } from "./socket/index.js";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/songs", songsRouter);
app.use("/api/queue", queueRouter);
app.use("/api/spotify", spotifyRouter);
app.use("/api/admin", authenticate, requireAdmin, adminRouter);

// Serve the built web app in production only. The built server lives at
// `packages/server/dist/index.js`, so the web build sits at `../../web/dist`.
// In dev we run via `tsx` (this file ends in `.ts`); Vite serves the UI with HMR.
const isProduction = import.meta.url.endsWith(".js");
const webDist = resolvePath(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (isProduction && existsSync(webDist) && statSync(webDist).isDirectory()) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
    res.sendFile(resolvePath(webDist, "index.html"));
  });
}

app.use(errorHandler);

initSocket(server);

const port = Number(PORT);

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

server.listen(port, "0.0.0.0", () => {
  const urls = ["127.0.0.1", ...lanAddresses()].map((ip) => `http://${ip}:${port}`);
  if (isProduction) {
    console.log("\nPlayPlay is running:");
    for (const url of urls) console.log(`  ${url}`);
    console.log("\n  Admin:    /admin");
    console.log("  Patron:   /  (share this URL with patrons)");
    console.log("  Display:  /now-playing\n");
  } else {
    console.log(`\nPlayPlay API listening on :${port} (dev)`);
    console.log("  → open the Vite dev URL (printed above) for HMR\n");
  }
});
