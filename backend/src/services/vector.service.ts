import { pool } from "../db.js";
import { openai } from "../openai.js";
import type { Chunk } from "../types/chat.types.js";

export async function searchDocumentChunks(question: string): Promise<Chunk[]> {
  // Gera o embedding da pergunta para permitir a busca semantica no banco vetorial
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });

  const questionEmbedding = embeddingResponse.data[0].embedding;

  const searchResult = await pool.query<Chunk>(
    `
    SELECT
      id,
      content,
      document_name,
      page_number,
      1 - (embedding <=> $1::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> $1::vector
    LIMIT 5;
    `,
    [`[${questionEmbedding.join(",")}]`],
  );

  return searchResult.rows;
}
