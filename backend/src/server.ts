import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { openai } from "./openai.js";

const app = express();

app.use(cors());
app.use(express.json());


/*
 * Porta HTTP usada pelo Backend
 *
 * Valor podde ser configurado na variavel de ambiente `PORT`
 * Caso nao exista a API usa porta 3001
 */
const PORT = Number(process.env.PORT ?? 3001);

/*
 * Similaridade minima exigida para considerar um chunk do banco como relevante
 * 
 * Esse limite serve para evitar respostas sem contexto suficiente
 * Caso o chunk nao atingir o valor, a aplicacao retorna mensagem de fallback  
 */
const MIN_SIMILARITY = Number(process.env.MIN_SIMILARITY ?? 0.75);

/*
 * Representa um trecho do documento recuperado do banco vetorial
 *
 * Cada chunk contem textual indexado, metadados da fonte original
 * e a pontuacao de similaridade calculada na busca semantica
 */
type Chunk = {
  id: string;
  content: string;
  document_name: string;
  page_number: number | null;
  similarity: number;
};



// Endpoint /health para obter estado da API
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/*
 * Endpoint principal do chat
 *
 * 1. Recebe a pergunta enviada pelo front  
 * 2. Gera embedding da pergunta com OpenAI 
 * 3. Busca os chunks mais similares no PostgreSQL com pgvector 
 * 4. Verifica se existe contexto relevante o bastante 
 * 5. Envia apenas o contexto recuperado para IA responder 
 * 6. Retorna a resposta junto com as ferramentas usadas 
 *
 * Se nenhum trecho relevante for encontrado, a IA nao eh chamada para responder
 * com conhecimento externo. A API retorna uma mensagem padrao informando que 
 * nao encontrou a informacao nos documentos fornecidos 
 */
app.post("/chat", async (req, res) => {
  try {
    const question = String(req.body.question ?? "").trim();

    // Impede chamadddas sem pergunta valida
    if (!question) {
      return res.status(400).json({
        error: "A pergunta é obrigatória.",
      });
    }

    /*
     * Gera vetor numerico para responder semanticamente a pergunta
     *
     * Esse embedding sera comparado com os embeddings dos chunks salvos no banco
     */
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const questionEmbedding = embeddingResponse.data[0].embedding;
    
    /*
     * Busca os cinco chunks mais proximos dda pergunta no banco vetorial
     *
     * O operador `<=>` do pgvector calcula a distancia cosseno 
     * Como distancia menor significa proximidade, usamos `1 - distancia`
     * para transformar o resultado em uma pontuacao de similaridade 
     */
    const searchResult = await pool.query<Chunk>(
      `
      SELECT
        id,
        content,
        document_name,
        page_number,
        1 - (embedding <=> $1::vector) AS similarity
      FROM document_chunks
      ORDER BY embedding <=> $1::vector
      LIMIT 5;
      `,
      [`[${questionEmbedding.join(",")}]`]
    );

    const chunks: Chunk[] = searchResult.rows;

    /*
     * Fallback anti-alucinacao
     *
     * Se nao houver chunks ou se o melhor resultado estiver abaixo do limite minima
     * a resposta eh encerrada aqui
     */
    if (chunks.length === 0 || chunks[0].similarity < MIN_SIMILARITY) {
      return res.json({
        answer: "Não encontrei essa informação nos documentos fornecidos.",
        sources: [],
      });
    }

    // Monta conexto que sera enviado ao modelo de linguagem
    const context = chunks
      .map((chunk: Chunk, index: number) => {
        return [
          `Fonte ${index + 1}`,
          `Documento: ${chunk.document_name}`,
          `Página: ${chunk.page_number ?? "não informada"}`,
          `Conteúdo: ${chunk.content}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    // Solicita a resposta da IA usando prompt restritivo
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Você é uma IA especializada em contabilidade.

Responda exclusivamente com base no CONTEXTO fornecido.

Regras:
1. Não invente informações.
2. Se a resposta não estiver no contexto, diga exatamente:
"Não encontrei essa informação nos documentos fornecidos."
3. Cite as fontes usadas ao final.
4. Seja claro, objetivo e técnico.
5. Não use conhecimento externo.
          `.trim(),
        },
        {
          role: "user",
          content: `
CONTEXTO:
${context}

PERGUNTA:
${question}
          `.trim(),
        },
      ],
    });

    // Garante uma resposta segura caso a API nao retorne conteudo textual
    const answer =
      completion.choices[0]?.message?.content ??
      "Não encontrei essa informação nos documentos fornecidos.";

    return res.json({
      answer,
      sources: chunks.map((chunk: Chunk) => ({
        documentName: chunk.document_name,
        pageNumber: chunk.page_number,
        similarity: chunk.similarity,
      })),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro interno ao processar a pergunta.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
