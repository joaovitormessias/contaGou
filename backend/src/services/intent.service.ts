import { z } from "zod";
import type { IntentClassification } from "../types/chat.types.js";
import { intentClassifierPrompt } from "../prompts/intent.prompt.js";
import { searchPlannerModel } from "../langchain.js";

const intentSchema = z.object({
  intent: z.enum(["document_question", "general_accounting", "out_of_scope"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

// Classifica a intencao do usuario
export async function classifyIntent(
  question: string,
): Promise<IntentClassification> {
  try {
    // Forca formato estruturado de saida
    const structuredModel = searchPlannerModel.withStructuredOutput(
      intentSchema,
      {
        name: "intent_classification",
        strict: true,
      },
    );

    const result = await structuredModel.invoke(
      [
        {
          role: "system",
          content: intentClassifierPrompt,
        },
        {
          role: "user",
          content: question,
        },
      ],
      {
        runName: "intent_classifier",
        tags: ["contagou", "intent"],
        metadata: {
          inputLength: question.length,
        },
      },
    );
    return result;
  } catch {
    // Fallback
    return {
      intent: "out_of_scope",
      confidence: 0,
      reason: "Nao foi possivel classificar a pergunta com seguranca.",
    };
  }
}
