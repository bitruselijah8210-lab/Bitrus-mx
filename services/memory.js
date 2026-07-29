import Redis from "ioredis";
import pg from "pg";

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

const TURN_BUFFER_TTL = 60 * 30; // 30 minutes
const MAX_TURNS = 12;

/** Load recent turn buffer for a session. Falls back to [] if Redis is down. */
export async function getTurnBuffer(sessionId) {
  if (!redis) return [];
  try {
    const raw = await redis.get(`session:${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // stateless fallback per error-handling policy
  }
}

export async function appendTurn(sessionId, userMsg, assistantMsg) {
  if (!redis) return;
  try {
    const buf = await getTurnBuffer(sessionId);
    buf.push({ role: "user", content: userMsg });
    buf.push({ role: "assistant", content: assistantMsg });
    const trimmed = buf.slice(-MAX_TURNS * 2);
    await redis.set(`session:${sessionId}`, JSON.stringify(trimmed), "EX", TURN_BUFFER_TTL);
  } catch {
    // best-effort; a failed memory write should never break the response
  }
}

/** Fetch durable user profile facts (name, language pref, etc.) */
export async function getUserProfile(userId) {
  if (!pool) return {};
  try {
    const { rows } = await pool.query(
      "SELECT profile_json FROM users WHERE id = $1",
      [userId]
    );
    return rows[0]?.profile_json || {};
  } catch {
    return {};
  }
}

/** Persist the full turn to durable conversation history (for QA/analytics). */
export async function logConversationTurn(userId, sessionId, userMsg, assistantMsg, lang) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO conversations (user_id, session_id, user_message, assistant_message, language, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, sessionId, userMsg, assistantMsg, lang]
    );
  } catch {
    // logging failure should not affect the user-facing response
  }
}

