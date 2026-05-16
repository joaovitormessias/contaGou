import { openai } from "../openai.js";
import type {
  Chunk,
  ChatResponse,
  IntentClassification,
} from "../types/chat.types.js";
import { searchDocumentChunks } from "./vector.service.js";
import { documentAnswerPrompt } from "../prompts/document-answer.prompt.js";

// Similaridade minima exigida para aceitar um trecho como texto relevante
const MIN_SIMILARITY = Number(process.env.MIN_SIMILARITY ?? 0.55);

function formatContext(chunks: Chunk[]): string {
  // Organiza os chunks recuperados em um contexto rastreavel para o modelo
  return chunks
    .map((chunk: Chunk, index: number) => {
      return [
        `Fonte ${index + 1}`,
        `Documento: ${chunk.document_name}`,
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
  const chunks = await searchDocumentChunks(question);

  console.log(
    "Busca vetorial:",
    chunks.map((chunk) => ({
      document: chunk.document_name,
      page: chunk.page_number,
      similarity: chunk.similarity,
      preview: chunk.content.slice(0, 120),
    })),
  );

  if (chunks.length === 0 || chunks[0].similarity < MIN_SIMILARITY) {
    return {
      answer: "Nao encontrei essa informacao nos documentos fornecidos.",
      sources: [],
      intent: classification.intent,
      confidence: classification.confidence,
    };
  }

  const context = formatContext(chunks);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    temperature: 0,
    messages: [
      {
        role: "developer",
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
  });

  const answer =
    completion.choices[0]?.message?.content ??
    "Nao encontrei essa informacao nos documentos fornecidos.";

  return {
    answer,
    intent: classification.intent,
    confidence: classification.confidence,
    sources: chunks.map((chunk) => ({
      documentName: chunk.document_name,
      pageNumber: chunk.page_number,
      similarity: chunk.similarity,
    })),
  };
}
