# ============================================================================
# SPARROWX SOVEREIGN SELF-HOSTED DOCKERFILE (OVH UBUNTU SERVER)
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Build with VITE_SOVEREIGN_SELF_HOSTED="true" so OVH Docker uses same-origin (/rest/v1/*) with cloud fallback
ENV VITE_SOVEREIGN_SELF_HOSTED="true"
ENV VITE_SUPABASE_URL=""
ENV VITE_SUPABASE_ANON_KEY="spx_ovh_sovereign_key"
ENV NITRO_PRESET="node-server"

RUN npm run build

# ============================================================================
# Production Runtime Image
# ============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOST="0.0.0.0"
ENV SPARROWX_DATA_DIR="/app/data"

RUN mkdir -p /app/data

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/ovh ./ovh

EXPOSE 3000

CMD ["node", "ovh/node-server.mjs"]
