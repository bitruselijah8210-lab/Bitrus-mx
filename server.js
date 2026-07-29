import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import chatRoutes from "./routes/chat.js";
import voiceRoutes from "./routes/voice.js";
import whatsappRoutes from "./integrations/whatsapp.js";
import telegramRoutes from "./integrations/telegram.js";
import messengerRoutes from "./integrations/messenger.js";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

// Basic abuse protection
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 req/min/IP
app.use("/api/", limiter);

// Serve the web widget as static files
app.use("/widget", express.static("../frontend"));

// Core chat API (used directly by the web widget, and internally by channel adapters)
app.use("/api", chatRoutes);

// Voice: speech-to-text, text-to-speech, and combined voice-chat
app.use("/api", voiceRoutes);

// Channel webhooks
app.use("/webhooks", whatsappRoutes);
app.use("/webhooks", telegramRoutes);
app.use("/webhooks", messengerRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alheri chatbot backend listening on :${PORT}`));
