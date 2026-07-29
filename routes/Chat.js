import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { callClaude } from "../services/anthropic.js";
import { getTurnBuffer, appendTurn, getUserProfile, logConversationTurn } from "../services/memory.js";
import { retrieveContext } from "../services/knowledgeBase.js";
import { preFilter, postFilter, fallbackMessage } from "../services/safety.js";
import { detectLanguage } from "../services/language.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "../prompts/system-prompt.txt"),
  "utf-8"
);

const router = express.Router();

router.post("/chat", async (req, res) => {
  const { userId, sessionId, channel, message } = req.body;

  if (!userId || !message || !message.trim()) {
    return res.status(400).json({ error: "userId and message are required" });
  }

  const sid = sessionId || `${channel || "web"}:${userId}`;
  const lang = detectLanguage(message);

  // 1. Safety pre-filter
  const pre = preFilter(message);
  if (pre.blocked) {
    return res.json({ reply: fallbackMessage(lang), lang });
  }

  try {
    // 2. Load context
    const [turnBuffer, profile, kbChunks] = await Promise.all([
      getTurnBuffer(sid),
      getUserProfile(userId),
      retrieveContext(message),
    ]);

    // 3. Assemble system prompt with dynamic context
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (Object.keys(profile).length) {
      systemPrompt += `\n\nKnown user profile facts (use only if relevant): ${JSON.stringify(profile)}`;
    }
    if (kbChunks.length) {
      systemPrompt += `\n\nRelevant reference material:\n${kbChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n")}`;
    }

    const messages = [...turnBuffer, { role: "user", content: message }];

    // 4. Call LLM
    const reply = await callClaude(systemPrompt, messages);

    // 5. Safety post-filter
    const post = postFilter(reply);
    const finalReply = post.safe ? reply : post.replacement;

    // 6. Persist memory (best-effort, non-blocking for the response)
    appendTurn(sid, message, finalReply);
    logConversationTurn(userId, sid, message, finalReply, lang);

    return res.json({ reply: finalReply, lang });
  } catch (err) {
    console.error("chat error:", err);
    return res.status(200).json({
      reply: fallbackMessage(lang),
      lang,
      error: true,
    });
  }
});

export default router;
