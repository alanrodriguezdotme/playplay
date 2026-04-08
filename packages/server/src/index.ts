import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import songsRouter from "./routes/songs.js";
import adminRouter from "./routes/admin.js";
import { authenticate, requireAdmin } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/songs", songsRouter);
app.use("/api/admin", authenticate, requireAdmin, adminRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
