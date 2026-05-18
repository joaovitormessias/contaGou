import type { Request, Response } from "express";
import { classifyIntent } from "../services/intent.service.js";
import { answerWithDocuments } from "../services/document-answer.service.js";
import { answerGeneralAccounting } from "../services/general-accounting.service.js";
import { traceable } from "langsmith/traceable";

const runChatPipeline = traceable(
  async (question: string) => {
    const classification = await classifyIntent(question);

    console.log("Classificacao:", {
      question,
      ...classification,
    });

    if (classification.intent === "document_question") {
      return answerWithDocuments(question, classification);
    }

    if (classification.intent === "general_accounting") {
      return answerGeneralAccounting(question, classification);
    }

    return {
      answer:
        "Eu so posso responder perguntas relacionadas a contabilidade ou aos documentos contabeis carregados.",
      sources: [],
      intent: classification.intent,
      confidence: classification.confidence,
    };
  },
  {
    name: "chat_request",
    tags: ["contagou", "chat"],
    metadata: {
      app: "ContaGou",
      layer: "backend",
    },
  },
);

export async function handleChat(req: Request, res: Response) {
  try {
    const question = String(req.body.question ?? "").trim();

    if (!question) {
      return res.status(400).json({
        error: "A pergunta eh obrigatoria.",
      });
    }

    const response = await runChatPipeline(question);

    return res.json(response);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro interno ao processar a pergunta.",
    });
  }
}
