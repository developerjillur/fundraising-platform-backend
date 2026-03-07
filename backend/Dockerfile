# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./

# Only install production dependencies
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist

# Create uploads directory if required by serve-static
RUN mkdir -p uploads

# Expose port (default 3000)
ENV PORT=3000
EXPOSE $PORT

CMD ["node", "dist/main"]
