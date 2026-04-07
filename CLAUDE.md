# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fundraising & live stream platform ("The Last McDonald's Burger"). Supporters pay to display photos on a YouTube live stream, buy merchandise (Printful), and enter a grand prize draw. Monorepo with NestJS backend and Next.js frontend.

## Common Commands

All backend commands run from `backend/`:

```bash
# Development
npm run start:dev          # NestJS watch mode (port 3001)
npm run seed               # Seed database (ts-node src/database/seed.ts)

# Build & Production
npm run build              # nest build
npm run start:prod         # node dist/main

# Testing
npm test                   # jest
npm run test:watch         # jest --watch
npm run test:cov           # jest --coverage
npm run test:e2e           # jest with e2e config (test/jest-e2e.json)

# Lint
npm run lint               # eslint with auto-fix
```

Frontend commands run from `frontend/`:

```bash
npm run dev                # Next.js dev server (port 8080)
npm run build
```

## Architecture

### Backend (`backend/src/`)

**NestJS 10 + TypeORM + MySQL 8.** All API routes prefixed with `/api`.

- **`domain/`** — 10 feature modules, each following controller → service → entity pattern:
  - `auth/` — JWT auth (passport-jwt strategy), admin registration/login
  - `fundraising/` — Stats aggregation, recent supporters, displayed photos, SSE stream
  - `photo/` — Photo packages (Standard/Premium), upload handling
  - `payment/` — Stripe checkout sessions + webhook handler (raw body required)
  - `stream/` — Queue management, SSE events, YouTube viewer counts
  - `merchandise/` — Products, orders, Printful sync & webhooks
  - `notification/` — Email templates, Resend integration
  - `admin/` — 27 dashboard endpoints (supporters, orders, queue, reports, CSV export)
  - `settings/` — Dynamic site configuration stored in DB (SiteSetting entity)
  - `health/` — Health check endpoint

- **`common/`** — Shared code:
  - `guards/jwt-auth.guard.ts` — `@UseGuards(JwtAuthGuard)` for protected routes
  - `decorators/current-user.decorator.ts` — `@CurrentUser()` extracts user from request
  - `services/s3.service.ts` — Global S3 upload service

- **`database/seed.ts`** — Initializes tables and default data (admin user, packages, settings)

### Key Patterns

- **Global prefix**: All endpoints are under `/api` (set in `main.ts`)
- **Swagger docs**: Available at `/api/docs`
- **SSE endpoints**: `/api/fundraising/stream` and `/api/stream/queue/stream` for real-time updates
- **Dynamic config**: Stripe keys, Printful tokens, and other integration settings are stored in the `site_setting` table, not env vars. The `SettingsService` provides them at runtime.
- **Raw body**: Enabled on app creation for Stripe webhook signature verification
- **Rate limiting**: Global throttle at 100 requests per 60 seconds
- **Event emitter**: `@nestjs/event-emitter` used for async cross-module communication
- **Validation**: Global `ValidationPipe` with `whitelist: true` and `transform: true`

### Database

13 TypeORM entities with `synchronize: true` in development. Key entities: `Admin`, `Supporter`, `StreamQueue`, `PhotoPackage`, `Merchandise`, `Order`, `OrderItem`, `SiteSetting`, `EmailTemplate`, `FundraisingStats`, `CustomerStats`, `GrandPrizeEntry`, `StreamEvent`.

### External Integrations

| Service | Config Source | Notes |
|---------|-------------|-------|
| Stripe | DB (SiteSetting) | Checkout + webhooks at `/api/payments/webhooks/stripe` |
| Printful | DB (SiteSetting) | Merch fulfillment, webhooks at `/api/merchandise/webhooks/printful` |
| Resend | DB (SiteSetting) | Transactional emails |
| AWS S3 | Env vars | Photo/file storage via global S3Service |
| YouTube Data API | DB (SiteSetting) | Live viewer counts |

### Docker

`docker-compose.yml` at root runs MySQL 8, backend, and frontend. Uses `dokploy-network` for deployment.

## Environment Variables

Backend env vars are in `backend/.env`. Key ones: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT` (default 3001), `FRONTEND_URL` (CORS origin), `AWS_S3_*` credentials.

Frontend: `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.
