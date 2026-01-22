import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer } from "http";

// Routes
import authRoutes from "./routes/auth";
import meetingRoutes from "./routes/meetings";

// SFU
import { SFUServer } from "./services/SFUServer";

dotenv.config();

const app = express();
const server = createServer(app);

/* ===================== GLOBAL REQUEST LOGGER ===================== */
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`--> ${req.method} ${req.originalUrl}`);

  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      `<-- ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`
    );
  });

  next();
});

/* ===================== MIDDLEWARE ===================== */
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===================== DATABASE ===================== */
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/webrtc-app";

mongoose.connect(MONGO_URI).then(() => {
  console.log(`[DB] Connected: ${MONGO_URI}`);
}).catch(err => {
  console.error("[DB] Connection failed:", err);
  process.exit(1);
});

mongoose.connection.on("error", err => {
  console.error("[DB] Runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] Disconnected");
});

/* ===================== ROUTES ===================== */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

console.log("[ROUTES] /api/auth -> register, login, me");
console.log("[ROUTES] /api/meetings -> meeting APIs");

app.get("/", (req, res) => {
  res.json({ status: "WebRTC SFU backend running" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

/* ===================== SFU ===================== */
const sfuServer = new SFUServer(server);
console.log("[SFU] Signaling + Media server initialized");

/* ===================== ERROR HANDLER ===================== */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("========== SERVER ERROR ==========");
  console.error("Time:", new Date().toISOString());
  console.error("Route:", req.method, req.originalUrl);
  console.error("Body:", req.body);
  console.error("Stack:", err.stack);
  console.error("==================================");

  res.status(500).json({ message: "Internal Server Error" });
});

/* ===================== BOOT ===================== */
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log("==================================");
  console.log(`[BOOT] Server running on :${PORT}`);
  console.log(`[BOOT] ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`[BOOT] Frontend: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  console.log("==================================");
});
