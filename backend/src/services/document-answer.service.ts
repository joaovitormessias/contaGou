import type {
  Chunk,
  ChatResponse,
  IntentClassification,
} from "../types/chat.types.js";
import { documentAnswerPrompt } from "../prompts/document-answer.prompt.js";
import { buildDocumentSearchPlan } from "./document-search-plan.service.js";
import { searchDocumentChunksWithPlan } from "./vector.service.js";
import { strictAccountingModel } from "../langchain.js";

// Similaridade minima exigida para aceitar um trecho como texto relevante
const MIN_SIMILARITY = Number(process.env.MIN_SIMILARITY ?? 0.55);

function formatContext(chunks: Chunk[]): string {
  // Organiza os chunks recuperados em um contexto recuperavel
  return chunks
    .map((chunk: Chunk, index: number) => {
      return [
        `Trecho ${index + 1}`,
        `Nome do documento: ${chunk.document_name}`,
        `Pagina: ${chunk.page_number ?? "nao informada"}`,
        `Conteudo: ${chunk.content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export async function answerWithDocuments(
  question: string,
  classification: IntentClassification,
): Promise<ChatResponse> {
  const searchPlan = await buildDocumentSearchPlan(question);

  console.log("Plano de busca documental:", searchPlan);

  const chunks = await searchDocumentChunksWithPlan(searchPlan);

  console.log(
    "Busca documental:",
    chunks.map((chunk) => ({
      document: chunk.document_name,
      page: chunk.page_number,
      similarity: chunk.similarity,
      preview: chunk.content.slice(0, 160),
    })),
  );

  // Resultados lexicais recebem similiridade 1 e nao dependem do limite vetorial
  const hasLexicalResult = chunks.some((chunk) => chunk.similarity === 1);

  if (
    chunks.length === 0 ||
    (!hasLexicalResult && chunks[0].similarity < MIN_SIMILARITY)
  ) {
    return {
      answer: "Nao encontrei essa informacao nos documentos fornecidos.",
      sources: [],
      intent: classification.intent,
      confidence: classification.confidence,
    };
  }
  const context = formatContext(chunks);

  const completion = await strictAccountingModel.invoke(
    [
      {
        role: "system",
        content: documentAnswerPrompt,
      },
      {
        role: "user",
        content: `
CONTEXTO DOCUMENTAL:
${context}

PERGUNTA:
${question}
      `.trim(),
      },
    ],
    {
      runName: "document_answer_generation",
      tags: ["contagou", "document_answer", "rag"],
      metadata: {
        intent: classification.intent,
        confidence: classification.confidence,
        chunks: chunks.length,
        sources: chunks.map((chunk) => ({
          document: chunk.document_name,
          page: chunk.page_number,
          similarity: chunk.similarity,
        })),
      },
    },
  );
  const answer =
    typeof completion.content === "string"
      ? completion.content
      : "Nao encontrei essa informacao nos documentos";

  const uniqueSources = Array.from(
    new Map(
      chunks.map((chunk) => [
        `${chunk.document_name}-${chunk.page_number ?? "sem-pagina"}`,
        {
          documentName: chunk.document_name,
          pageNumber: chunk.page_number,
          similarity: chunk.similarity,
        },
      ]),
    ).values(),
  );

  return {
    answer,
    intent: classification.intent,
    confidence: classification.confidence,
    sources: uniqueSources,
  };
}
