import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

// IA restrita para documentos
export const strictAccountingModel = new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "gpt-5.4",
  temperature: 0,
});

// IA de atendimento geral
export const generalAccountingModel = new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "gpt-5.4",
  temperature: 0.2,
});

// IA de planejamento
export const searchPlannerModel = new ChatOpenAI({
  model: process.env.OPENAI_SMALL_MODEL ?? "gpt-5.4-mini",
  temperature: 0,
});

// Embbeding
export const embeddingsModel = new OpenAIEmbeddings({
  model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
});
