import type {
  ChatResponse,
  IntentClassification,
} from "../types/chat.types.js";
import { generalAccountingPrompt } from "../prompts/general-accounting.prompt.js";
import { generalAccountingMOdel } from "../langchain.js";

export async function answerGeneralAccounting(
  question: string,
  classification: IntentClassification,
): Promise<ChatResponse> {
  const completion = await generalAccountingMOdel.invoke([
    {
      role: "system",
      content: generalAccountingPrompt,
    },
    {
      role: "user",
      content: question,
    },
  ]);

  const answer =
    typeof completion.content === "string"
      ? completion.content
      : "Nao consegui gerar uma resposta contabil para essa pergunta";

  return {
    answer,
    intent: classification.intent,
    confidence: classification.confidence,
    // Resposta gerais nao usam docuentos, por isso nao retornam fontes
    sources: [],
  };
}
