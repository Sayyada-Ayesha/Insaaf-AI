# ============================================================================
# INSAaf AI — production image.
# Single cloud service: the Express server serves the built frontend (dist/)
# AND the /api. The INSAaf owned model (corpus + composer in server/) runs
# server-side here — never on the user's device — and makes NO external LLM
# call at runtime (AI_PROVIDER=insaaf, runtimeExternalLLMCalls=NONE).
# ============================================================================

# ---- Stage 1: build the React/Vite frontend into dist/ ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
# Source + the public Firebase web config (imported by src/lib/firebase.ts).
COPY . .
RUN npm run build

# ---- Stage 2: lean runtime — production deps + server + RAG corpus + dist ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
# Backend (owned-model composer, RAG engine, doc model, providers) + corpus.
COPY server ./server
COPY rag ./rag
# The built frontend served by Express (express.static + SPA fallback).
COPY --from=build /app/dist ./dist
# Runtime secrets/config (AI_PROVIDER, APP_URL, PORT, optional provider keys)
# are injected by the platform as environment variables — never baked in.
EXPOSE 3001
CMD ["node", "server/index.js"]
