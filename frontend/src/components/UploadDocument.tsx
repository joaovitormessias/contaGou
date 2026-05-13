import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { uploadDocument } from "../services/upload";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function UploadDocument() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleUpload() {
    if (!selectedFile) {
      setStatus("error");
      setMessage("Selecione um arquivo antes de enviar.");
      return;
    }

    // O fluxo de ingestao foi preparado para processar apenas PDFs
    if (selectedFile.type !== "application/pdf") {
      setStatus("error");
      setMessage("Envie apenas arquivos PDF.");
      return;
    }

    try {
      setStatus("uploading");
      setMessage("");

      // Envia o arquivo para o webhook/fluxo responsavel pela indexação no n8n
      await uploadDocument(selectedFile);

      setStatus("success");
      setMessage("Documento enviado para processamento com sucesso.");
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Erro ao enviar o documento para o n8n.");
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Upload de documento
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Envie um PDF para indexação no banco vetorial.
      </Typography>

      <Box
        sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}
      >
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon />}
        >
          Selecionar PDF
          <input
            hidden
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              setStatus("idle");
              setMessage("");
            }}
          />
        </Button>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || status === "uploading"}
        >
          Enviar
        </Button>

        {selectedFile && (
          <Typography variant="body2">{selectedFile.name}</Typography>
        )}
      </Box>

      {status === "uploading" && <LinearProgress sx={{ mt: 2 }} />}

      {message && (
        <Alert
          severity={status === "success" ? "success" : "error"}
          sx={{ mt: 2 }}
        >
          {message}
        </Alert>
      )}
    </Paper>
  );
}
