import express from "express";
import fetch from "node-fetch";
import { transcribeAudio } from "../services/voice.js";

const router = express.Router();

async function downloadWhatsAppMedia(mediaId) {
  const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
  });
  const { url } = await metaRes.json();
  const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
  return Buffer.from(await fileRes.arrayBuffer());
}

// Webhook verification (Meta requires this GET handshake)
router.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Incoming messages
router.post("/whatsapp", async (req, res) => {
  res.sendStatus(200); // ack immediately; Meta expects a fast response

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message || (message.type !== "text" && message.type !== "audio")) return;

    const from = message.from; // user's WhatsApp ID (phone number)
    let text;
    if (message.type === "audio") {
      const audioBuffer = await downloadWhatsAppMedia(message.audio.id);
      text = await transcribeAudio(audioBuffer, "voice.ogg");
      if (!text) return; // couldn't transcribe — silently skip (could send an error text instead)
    } else {
      text = message.text.body;
    }

    const chatRes = await fetch(`${process.env.INTERNAL_BASE_URL || "http://localhost:3000"}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: from, channel: "whatsapp", message: text }),
    });
    const { reply } = await chatRes.json();

    await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        }),
      }
    );
  } catch (err) {
    console.error("whatsapp webhook error:", err);
  }
});

export default router;

