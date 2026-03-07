# The Last McDonald's Burger — Fundraising Platform

A full-stack fundraising and live stream platform built around the famous last McDonald's burger in Iceland. Supporters pay to display their photos on a YouTube live stream, purchase limited-edition merchandise, and enter a grand prize draw.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS, shadcn/ui, Framer Motion |
| **Backend** | NestJS 10, TypeORM, MySQL 8 |
| **Payments** | Stripe Checkout + Webhooks |
| **Fulfillment** | Printful API (auto-fulfill merch orders) |
| **Email** | Resend (transactional emails) |
| **Storage** | Local filesystem (`backend/uploads/`) |
| **Auth** | JWT (admin dashboard) |
| **Real-time** | Server-Sent Events (SSE) |

## Project Structure

```
.
├── backend/          # NestJS API server
│   ├── src/
│   │   ├── domain/   # 10 modules: auth, fundraising, photo, payment,
│   │   │              #   stream, merchandise, notification, admin, settings, health
│   │   ├── common/    # Guards, decorators, middleware
│   │   └── database/  # Seed script
│   └── uploads/       # Photo & screenshot storage
│
└── frontend/         # Next.js app (App Router)
    └── src/
        ├── app/       # Pages: home, admin, payment, stream-overlay, track-order
        ├── components/ # 17 sections + 7 admin + 49 UI components
        ├── hooks/     # Custom hooks
        └── lib/       # API client, utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### 1. Backend Setup

```bash
cd backend
cp .env.example .env   # Edit with your MySQL credentials
npm install
npm run seed           # Create tables + seed data
npm run start:dev      # Starts on http://localhost:3001
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.local.example .env.local   # Set NEXT_PUBLIC_API_URL
npm install
npm run dev            # Starts on http://localhost:8080
```

### Environment Variables

**Backend** (`backend/.env`):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=fundraising_db
JWT_SECRET=your-secret-key
PORT=3001
FRONTEND_URL=http://localhost:8080
```

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## API Documentation

Swagger docs are available at:

```
http://localhost:3001/api/docs
```

**70+ REST API endpoints** across 10 modules:

| Module | Endpoints | Auth |
|--------|-----------|------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Public / JWT |
| Fundraising | `GET /fundraising/stats`, `/recent-supporters`, `/displayed-photos`, `/prize-count`, `/stream` (SSE) | Public |
| Photos | `GET /photos/packages`, `POST /photos/upload`, CRUD packages | Public / JWT |
| Payments | `POST /payments/checkout/photo`, `/checkout/merch`, `/webhooks/stripe` | Public |
| Stream | `GET /stream/queue`, `/queue/next`, `/queue/display`, `/queue/count`, `/youtube-viewers`, `/queue/stream` (SSE) | Public |
| Merchandise | `GET /merchandise/products`, `/orders/lookup`, `/webhooks/printful`, `/sync` | Public / JWT |
| Admin | Dashboard, supporters, orders, queue management, products, email templates, stats, packages (27 endpoints) | JWT |
| Settings | `GET /settings`, `GET /settings/all`, `PUT /settings` | Public / JWT |
| Health | `GET /health` | Public |

## Features

### Public Site
- **Hero** with live viewer count and photo counter
- **Fundraising tracker** with real-time progress bar (SSE)
- **YouTube live stream** embed with overlay controls
- **Photo upload** — choose Standard ($10/10s) or Premium ($25/30s), upload photo, pay via Stripe
- **Supporter queue** — live display of upcoming photos
- **Merchandise store** — products synced from Printful with variant selection
- **Grand prize** section with entry tracking and countdown timer
- **FAQ** accordion
- **Order tracking** by email or order number
- **Dark/light mode** toggle

### Admin Dashboard
- **Overview** — revenue charts, stats, queue/package/moderation/fulfillment breakdowns
- **Photos** — manage packages, view/moderate submissions, export CSV
- **Products** — CRUD merchandise, sync from Printful, image upload
- **Stream Queue** — pause, skip, requeue, force next, swap positions, OBS overlay URL
- **Reports** — export CSV for all data (supporters, orders, customers, queue, revenue)
- **Data** — raw data tables with filters
- **Manage** — supporter and order management
- **Emails** — edit 6 transactional email templates
- **Prize Draw** — view entries, draw winner
- **Settings** — integrations (Stripe, Printful, Klaviyo, Resend), stream config, feature toggles, content editing

### Stream Overlay
- OBS browser source at `/stream-overlay`
- Auto-cycles supporter photos with badges
- Screenshot capture for keepsake emails

## Integrations

| Service | Purpose | Configuration |
|---------|---------|--------------|
| **Stripe** | Payment processing | API keys in Admin Settings |
| **Printful** | Merch fulfillment | API token + Store ID in Admin Settings |
| **Resend** | Transactional emails | API key in Admin Settings |
| **Klaviyo** | Email marketing events | API key in Admin Settings (optional) |
| **YouTube Data API** | Live viewer count | API key in Admin Settings |

## Default Admin Login

```
Email:    developerjillur@gmail.com
Password: admin12345
```

## License

All rights reserved.
