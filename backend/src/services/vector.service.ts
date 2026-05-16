import { pool } from "../db.js";
import { openai } from "../openai.js";
import type { Chunk, DocumentSearchPlan } from "../types/chat.types.js";

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

export async function searchDocumentChunksByKeywords(
  keywordQueries: string[],
): Promise<Chunk[]> {
  const cleanTerms = keywordQueries
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 8);

  if (cleanTerms.length === 0) {
    return [];
  }

  const conditions = cleanTerms
    .map((_term, index) => `unaccent(content) ILIKE unaccent($${index + 1})`)
    .join(" OR ");

  const values = cleanTerms.map((term) => `%${term}%`);

  const result = await pool.query<Chunk>(
    `
    SELECT
      id,
      content,
      document_name,
      page_number,
      1 AS similarity
    FROM document_chunks
    WHERE ${conditions}
    LIMIT 8;
    `,
    values,
  );

  return result.rows;
}

export async function searchDocumentChunksByVector(
  query: string,
): Promise<Chunk[]> {
  // Converte a consulta em embedding para executar busca semantica no pgvector
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const result = await pool.query<Chunk>(
    `
    SELECT
      id,
      content,
      document_name,
      page_number,
      1 - (embedding <=> $1::vector) AS similarity
    FROM document_chunks
    ORDER BY embedding <=> $1::vector
    LIMIT 8;
    `,
    [`[${queryEmbedding.join(",")}]`],
  );

  return result.rows;
}

function mergeChunks(primary: Chunk[], secondary: Chunk[]): Chunk[] {
  const map = new Map<string, Chunk>();

  // Remove chunks duplicados quando a mesma fonte aparece em buscas diferentes
  for (const chunk of [...primary, ...secondary]) {
    if (!map.has(chunk.id)) {
      map.set(chunk.id, chunk);
    }
  }

  return Array.from(map.values()).slice(0, 8);
}

export async function searchDocumentChunksWithPlan(
  plan: DocumentSearchPlan,
): Promise<Chunk[]> {
  // Executa apenas as estrategias definidas no plano de busca gerado para a pergunta
  const lexicalChunks =
    plan.searchType === "lexical" || plan.searchType === "hybrid"
      ? await searchDocumentChunksByKeywords(plan.keywordQueries)
      : [];

  const vectorChunks =
    plan.searchType === "semantic" || plan.searchType === "hybrid"
      ? await searchDocumentChunksByVector(plan.semanticQuery)
      : [];

  return mergeChunks(lexicalChunks, vectorChunks);
}
