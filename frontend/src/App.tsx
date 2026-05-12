import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  Divider,
} from "@mui/material";
import { api } from "./services/api";

type Source = {
  documentName: string;
  pageNumber?: number;
  similarity?: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

export default function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const trimmed = question.trim();

    if (!trimmed || loading) return;

    const userMessage: Message = {
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await api.post("/chat", {
        question: trimmed,
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: response.data.answer,
        sources: response.data.sources ?? [],
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "Erro ao consultar a IA. Verifique se o backend está rodando.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        IA para Contabilidade
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Faça perguntas com base nos documentos indexados.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, minHeight: 420, mb: 2 }}>
        {messages.length === 0 && (
          <Typography color="text.secondary">
            Nenhuma mensagem ainda. Um vazio administrativo, basicamente.
          </Typography>
        )}

        {messages.map((message, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Typography fontWeight={700}>
              {message.role === "user" ? "Você" : "IA"}
            </Typography>

            <Box sx={{ mt: 0.5 }}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </Box>

            {message.sources && message.sources.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" fontWeight={700}>
                  Fontes:
                </Typography>

                {message.sources.map((source, sourceIndex) => (
                  <Typography key={sourceIndex} variant="caption" display="block">
                    {source.documentName}
                    {source.pageNumber ? `, página ${source.pageNumber}` : ""}
                    {source.similarity
                      ? `, similaridade ${source.similarity.toFixed(3)}`
                      : ""}
                  </Typography>
                ))}
              </Box>
            )}

            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}

        {loading && <CircularProgress size={24} />}
      </Paper>

      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          label="Digite sua pergunta"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />

        <Button variant="contained" onClick={handleSend} disabled={loading}>
          Enviar
        </Button>
      </Box>
    </Container>
  );
}
