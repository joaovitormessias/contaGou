# IA para Contabilidade

## Objetivo

Aplicação web de chat especializada em contabilidade com respostas baseadas em documentos fornecidos.

## Stack

- React
- MUI
- Node.js
- OpenAI API
- n8n
- PostgreSQL + pgvector
- Docker

## Arquitetura

Explicar:
- Frontend
- Backend
- n8n
- Banco vetorial
- Fluxo RAG

## Como rodar

1. Clonar o projeto
2. Copiar `.env.example` para `.env`
3. Subir Docker
4. Importar workflow no n8n
5. Fazer upload dos documentos
6. Acessar o chat

## Confiabilidade

Explicar que:
- A IA responde apenas com base nos documentos
- Caso não exista contexto, retorna mensagem padrão
- Todas as respostas trazem fontes

## Workflows n8n

Explicar como importar o arquivo `.json`.

## Variáveis de ambiente

Listar variáveis sem valores reais.
