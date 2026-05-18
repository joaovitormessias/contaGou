import {
  PGVectorStore,
  type DistanceStrategy,
} from "@langchain/community/vectorstores/pgvector";
import { pool } from "../db.js";
import { embeddingsModel } from "../langchain.js";

export function getLangChainVectorStore() {
  return new PGVectorStore(embeddingsModel, {
    pool,
    tableName: "document_chunks_langchain",
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    distanceStrategy: "cosine" as DistanceStrategy,
  });
}
