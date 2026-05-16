import type { Request, Response } from "express";
import { classifyIntent } from "../services/intent.service.js";
import { answerWithDocuments } from "../services/document-answer.service.js";
import { answerGeneralAccounting } from "../services/general-accounting.service.js";

export async function handleChat(req: Request, res: Response) {
  try {
    const question = String(req.body.question ?? "").trim();

    if (!question) {
      return res.status(400).json({
        error: "A pergunta eh obrigatoria.",
      });
    }

    // Classifica a pergunta para deicidir qual fluxo de resposta deve ser usado
    const classification = await classifyIntent(question);

    console.log("Classificacao:", {
      question,
      ...classification,
    });

    if (classification.intent === "document_question") {
      const response = await answerWithDocuments(question, classification);
      return res.json(response);
    }

    if (classification.intent === "general_accounting") {
      const response = await answerGeneralAccounting(question, classification);
      return res.json(response);
    }

    // Bloqueia perguntas fora do dominio contabil ou dos documentos carregados
    return res.json({
      answer:
        "Eu so posso responder perguntas relacionadas a contabilidade ou aos documentos contabeis carregados.",
      sources: [],
      intent: classification.intent,
      confidence: classification.confidence,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro interno ao processar a pergunta.",
    });
  }
}
