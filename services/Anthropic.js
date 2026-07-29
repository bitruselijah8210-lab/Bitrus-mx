import fetch from "node-fetch";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

/**
 * Calls the Anthropic Messages API with retry-once-on-failure.
 * @param {string} systemPrompt
 * @param {Array<{role: "user"|"assistant", content: string}>} messages
 * @returns {Promise<string>} the assistant's reply text
 */
export async function callClaude(systemPrompt, messages) {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const headers = {
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_URL, { method: "POST", headers, body });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API error ${res.status}: ${errText}`);
      }
      const data = await res.json();
      return data.content.map((block) => block.text || "").join("");
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 500)); // brief backoff, then retry once
    }
  }
}
