# ============================================================================
# SPARROWX SOVEREIGN SELF-HOSTED DOCKERFILE (OVH UBUNTU SERVER)
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Canonical Domain & Primary Environment Configuration
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV VITE_SOVEREIGN_SELF_HOSTED="true"
ENV VITE_APP_URL="https://db.sparrowx.net"
ENV SITE_URL="https://db.sparrowx.net"
ENV PUBLIC_URL="https://db.sparrowx.net"
ENV VITE_SITE_URL="https://db.sparrowx.net"
ENV VITE_API_URL="https://api.sparrowx.net"
ENV VITE_SPARROWX_API_URL="https://api.sparrowx.net"
ENV VITE_SPARROWX_WS_URL="wss://api.sparrowx.net/realtime"
ENV VITE_SUPABASE_URL="https://api.sparrowx.net"
ENV VITE_SUPABASE_ANON_KEY="spx_ovh_sovereign_key"
ENV ADDITIONAL_REDIRECT_URLS="https://db.sparrowx.net/**,https://sec.sparrowx.net/**,https://api.sparrowx.net/**"
ENV GOTRUE_SITE_URL="https://db.sparrowx.net"

RUN npm run build

# ============================================================================
# Production Runtime Image
# ============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOST="0.0.0.0"
ENV VITE_APP_URL="https://db.sparrowx.net"
ENV SITE_URL="https://db.sparrowx.net"
ENV PUBLIC_URL="https://db.sparrowx.net"
ENV VITE_SITE_URL="https://db.sparrowx.net"
ENV VITE_API_URL="https://api.sparrowx.net"
ENV VITE_SPARROWX_API_URL="https://api.sparrowx.net"
ENV VITE_SPARROWX_WS_URL="wss://api.sparrowx.net/realtime"
ENV SPARROWX_DATA_DIR="/app/data"

RUN mkdir -p /app/data /app/src/lib

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ovh ./ovh
COPY --from=builder /app/src/lib/migrated-seed.json ./src/lib/migrated-seed.json

EXPOSE 3000

CMD ["node", "ovh/node-server.mjs"]
