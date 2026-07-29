import fetch from "node-fetch";
import FormData from "form-data";

/**
 * Speech-to-text using OpenAI Whisper (handles English + Hausa reasonably
 * well). Swap the endpoint/model here if you standardize on a different
 * ASR provider (e.g. Google Cloud Speech-to-Text, which also has Hausa
 * support in several regions).
 *
 * @param {Buffer} audioBuffer - raw audio bytes (ogg/mp3/wav/m4a)
 * @param {string} filename - original filename with extension, used to hint format
 * @returns {Promise<string>} transcribed text
 */
export async function transcribeAudio(audioBuffer, filename = "audio.ogg") {
  const form = new FormData();
  form.append("file", audioBuffer, { filename });
  form.append("model", "whisper-1");
  // Hint the language when known; Whisper auto-detects otherwise.

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transcription failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.text?.trim() || "";
}

/**
 * Text-to-speech. English uses OpenAI TTS. Hausa coverage varies by
 * provider — if HAUSA_TTS_PROVIDER isn't configured, Hausa replies fall
 * back to a "voice not available, here's the text" response so the caller
 * can display text instead of silently failing.
 *
 * @param {string} text
 * @param {"en"|"ha"} lang
 * @returns {Promise<Buffer|null>} mp3 audio bytes, or null if unsupported
 */
export async function synthesizeSpeech(text, lang = "en") {
  if (lang === "ha" && !process.env.HAUSA_TTS_URL) {
    return null; // no configured Hausa TTS provider — caller should fall back to text
  }

  if (lang === "ha") {
    // Generic pluggable endpoint for a Hausa-capable TTS provider
    // (e.g. a hosted Coqui/MMS-TTS model). Expects { audio: <mp3 bytes> }.
    const res = await fetch(process.env.HAUSA_TTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  // English — OpenAI TTS
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
