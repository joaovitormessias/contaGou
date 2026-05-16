import { openai } from "../openai.js";
import type {
  ChatResponse,
  IntentClassification,
} from "../types/chat.types.js";
import { generalAccountingPrompt } from "../prompts/general-accounting.prompt.js";

export async function answerGeneralAccounting(
  question: string,
  classification: IntentClassification,
): Promise<ChatResponse> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    temperature: 0.2,
    messages: [
      {
        role: "developer",
        content: generalAccountingPrompt,
      },
      {
        role: "user",
        content: question,
      },
    ],
  });

  const answer =
    completion.choices[0]?.message?.content ??
    "Nao consegui gerar uma resposta contabil para essa pergunta.";

  return {
    answer,
    intent: classification.intent,
    confidence: classification.confidence,
    // Resposta gerais nao usam docuentos, por isso nao retornam fontes
    sources: [],
  };
}
