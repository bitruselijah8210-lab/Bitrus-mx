import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import { transcribeAudio, synthesizeSpeech } from "../services/voice.js";

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB cap
const router = express.Router();

// STT only — returns transcribed text
router.post("/voice/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio file is required" });
  try {
    const text = await transcribeAudio(req.file.buffer, req.file.originalname);
    res.json({ text });
  } catch (err) {
    console.error("transcribe error:", err);
    res.status(500).json({ error: "Could not transcribe audio. Please try again." });
  }
});

// TTS only — returns mp3 audio bytes
router.post("/voice/speak", express.json(), async (req, res) => {
  const { text, lang = "en" } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const audio = await synthesizeSpeech(text, lang);
    if (!audio) {
      return res.status(422).json({ error: "Voice output isn't available for this language yet." });
    }
    res.set("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (err) {
    console.error("speak error:", err);
    res.status(500).json({ error: "Could not generate speech." });
  }
});

// Combined: audio in -> transcribe -> run through chat -> speech out (+ text)
router.post("/voice/chat", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio file is required" });
  const { userId, sessionId, channel } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const userText = await transcribeAudio(req.file.buffer, req.file.originalname);
    if (!userText) {
      return res.status(422).json({ error: "Couldn't hear that clearly — please try again." });
    }

    const chatRes = await fetch(`${process.env.INTERNAL_BASE_URL || "http://localhost:3000"}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, sessionId, channel: channel || "voice", message: userText }),
    });
    const { reply, lang } = await chatRes.json();

    const audio = await synthesizeSpeech(reply, lang);
    res.json({
      transcript: userText,
      reply,
      lang,
      audioBase64: audio ? audio.toString("base64") : null,
    });
  } catch (err) {
    console.error("voice/chat error:", err);
    res.status(500).json({ error: "Voice chat failed. Please try again." });
  }
});

export default router;
