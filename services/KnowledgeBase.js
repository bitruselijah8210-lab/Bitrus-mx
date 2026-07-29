import pg from "pg";
import fetch from "node-fetch";

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

/**
 * Embeds text using any embedding endpoint you configure (Voyage AI shown
 * here as an example; swap for your provider of choice).
 */
async function embed(text) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ input: text, model: "voyage-2" }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * Retrieves the top-k most relevant knowledge base chunks for a query.
 * Requires a Postgres table: kb_chunks(id, content, embedding vector(1024))
 * with the pgvector extension enabled.
 */
export async function retrieveContext(query, k = 4, threshold = 0.75) {
  if (!pool || !process.env.VOYAGE_API_KEY) return [];
  try {
    const vector = await embed(query);
    const { rows } = await pool.query(
      `SELECT content, 1 - (embedding <=> $1) AS similarity
       FROM kb_chunks
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [JSON.stringify(vector), k]
    );
    return rows.filter((r) => r.similarity >= threshold).map((r) => r.content);
  } catch {
    // KB unavailable -> continue without RAG context (see error-handling policy)
    return [];
  }
}

