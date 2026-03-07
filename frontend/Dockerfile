# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable standalone mode via env var or it can be set in next.config.ts
ENV NEXT_PRIVATE_STANDALONE=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Next.js standalone output contains everything needed to run
# We just need to copy the standalone folder and static files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
