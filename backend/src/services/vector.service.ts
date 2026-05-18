import { pool } from "../db.js";
import type { Chunk, DocumentSearchPlan } from "../types/chat.types.js";
import { embeddingsModel } from "../langchain.js";

import crypto from "node:crypto";
import { getLangChainVectorStore } from "./pgvector-store.service.js";

const USE_LANGCHAIN_VECTOR_STORE =
  process.env.USE_LANGCHAIN_VECTOR_STORE === "true";
export async function searchDocumentChunks(question: string): Promise<Chunk[]> {
  // Gera o embedding da pergunta para permitir a busca semantica no banco vetorial

  const questionEmbedding = await embeddingsModel.embedQuery(question);

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
  const queryEmbedding = await embeddingsModel.embedQuery(query);

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

export async function searchDocumentChunksByLangChainVector(
  query: string,
): Promise<Chunk[]> {
  const vectorStore = getLangChainVectorStore();

  const results = await vectorStore.similaritySearchWithScore(query, 8);

  return results.map(([document, score]) => {
    const metadata = document.metadata as {
      documentName?: string;
      pageNumber?: number | null;
      chunkIndex?: number;
    };

    return {
      id: crypto.randomUUID(),
      content: document.pageContent,
      document_name: metadata.documentName ?? "documento.pdf",
      page_number: metadata.pageNumber ?? null,
      similarity: Math.max(0, Math.min(1, 1 - score)),
    };
  });
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
  const lexicalChunks =
    plan.searchType === "lexical" || plan.searchType === "hybrid"
      ? await searchDocumentChunksByKeywords(plan.keywordQueries)
      : [];

  const vectorChunks =
    plan.searchType === "semantic" || plan.searchType === "hybrid"
      ? USE_LANGCHAIN_VECTOR_STORE
        ? await searchDocumentChunksByLangChainVector(plan.semanticQuery)
        : await searchDocumentChunksByVector(plan.semanticQuery)
      : [];

  return mergeChunks(lexicalChunks, vectorChunks);
}
