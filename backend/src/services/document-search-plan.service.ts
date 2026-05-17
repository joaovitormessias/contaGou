import { z } from "zod";
import type { DocumentSearchPlan } from "../types/chat.types.js";
import { documentSearchPlanPrompt } from "../prompts/document-search-plan.prompt.js";
import { searchPlannerModel } from "../langchain.js";

// Define formato estrturado do modelo
const documentSearchPlanSchema = z.object({
  searchType: z.enum(["semantic", "lexical", "hybrid"]),
  semanticQuery: z.string(),
  keywordQueries: z.array(z.string()),
  expectedAnswerType: z.enum([
    "company_name",
    "tax_id",
    "date",
    "money",
    "accounting_concept",
    "summary",
    "unknown",
  ]),
  reason: z.string(),
});

export async function buildDocumentSearchPlan(
  question: string,
): Promise<DocumentSearchPlan> {
  try {
    // Forca saida estruturada do modelo
    const structuredModel = searchPlannerModel.withStructuredOutput(
      documentSearchPlanSchema,
      {
        name: "document_search_plan",
        strict: true,
      },
    );

    const result = await structuredModel.invoke([
      {
        role: "system",
        content: documentSearchPlanPrompt,
      },
      {
        role: "user",
        content: question,
      },
    ]);

    return result;
  } catch {
    return {
      searchType: "semantic",
      semanticQuery: question,
      keywordQueries: [],
      expectedAnswerType: "unknown",
      reason:
        "Nao foi possivel gerar plano de busca. Fallback para busca semantica.",
    };
  }
}
