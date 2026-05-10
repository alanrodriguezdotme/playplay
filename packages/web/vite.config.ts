import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read PORT from the server's .env so dev mode follows whatever the wizard configured.
function readServerPort(): number {
  try {
    const envPath = resolve(__dirname, "../server/.env");
    const text = readFileSync(envPath, "utf8");
    const match = text.match(/^\s*PORT\s*=\s*"?(\d+)"?/m);
    if (match) return Number(match[1]);
  } catch {
    // fall through to default
  }
  return 3001;
}

const SERVER_PORT = readServerPort();
// Vite must not collide with the API server. If the configured server port is the
// default Vite port (1738), bump Vite to 5173.
const VITE_PORT = SERVER_PORT === 1738 ? 5173 : 1738;
const PROXY_TARGET = `http://127.0.0.1:${SERVER_PORT}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: VITE_PORT,
    proxy: {
      "/api": {
        target: PROXY_TARGET,
        changeOrigin: true,
      },
      "/socket.io": {
        target: PROXY_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
