import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import songsRouter from "./routes/songs.js";
import adminRouter from "./routes/admin.js";
import queueRouter from "./routes/queue.js";
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
app.use("/api/admin", authenticate, requireAdmin, adminRouter);

app.use(errorHandler);

initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
