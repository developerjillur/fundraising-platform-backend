# Burger Fundraising Platform — API Reference

**Base URL (production):** `http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com/api`
**Interactive docs (Swagger UI):** `<base>/docs`

All routes are prefixed with `/api`. Responses are JSON. Authentication uses a JWT bearer token (`Authorization: Bearer <token>`) for protected endpoints. SSE endpoints emit JSON-encoded data frames every ~3 seconds.

## Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create initial admin (disabled when one exists) |
| `POST` | `/auth/login` | Public | Returns `{ token, user }` |
| `GET` | `/auth/me` | JWT | Current admin profile |

**Login example:**
```bash
curl -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"developerjillur@gmail.com","password":"admin12345"}'
```

## Photos

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/photos/packages` | Public | Active packages (Standard, Premium) |
| `GET` | `/photos/packages/all` | JWT | Includes inactive packages |
| `POST` | `/photos/upload` | Public, multipart | Upload + run moderation. Returns `{path, url, moderation_status, moderation_reason}` |
| `POST` | `/photos/reupload/:supporterId` | Public, multipart | Re-upload after a rejection (max 3 attempts, configurable) |
| `POST` | `/photos/packages` | JWT | Create package |
| `PUT` | `/photos/packages/:id` | JWT | Update package |
| `DELETE` | `/photos/packages/:id` | JWT | Remove package |

**Upload constraints:** max 10MB, MIME types `image/jpeg|png|gif|webp`.

**Moderation result:** When `moderation_enabled=true`, the upload is sent to AWS Rekognition. If any moderation labels meet the configured confidence threshold, the response returns `moderation_status: "rejected"` with a reason. The image is still saved (so it can be reviewed/audited) but won't enter the queue at payment time.

## Payments (Stripe)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/payments/checkout/photo` | Public | Create Stripe Checkout session for a photo package |
| `POST` | `/payments/checkout/merch` | Public | Create Stripe Checkout session for a merch order |
| `POST` | `/payments/webhooks/stripe` | Stripe signed | Handles `checkout.session.completed`, `payment_intent.payment_failed`, `checkout.session.expired`, `charge.refunded` |

**Photo checkout body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "package_type": "standard",
  "photo_storage_path": "photos/1709...uuid.jpg",
  "photo_url": "https://burger-prod-assets.s3...",
  "moderation_status": "approved",
  "moderation_reason": null,
  "origin": "https://example.com"
}
```

**Webhook side-effects (photo, on `checkout.session.completed`):**
1. Mark Supporter `payment_status = completed`
2. If `moderation_status = approved` → enqueue StreamQueue item
3. If `moderation_status = rejected` → send `photo_rejected` template + Klaviyo `Photo Rejected` event
4. Update fundraising stats and grand prize entries
5. Fire `Photo Purchased` Klaviyo event with full metadata

## Stream / Queue

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/stream/queue` | Public | Current displaying + next 10 + total waiting |
| `GET` | `/stream/queue/display` | Public | Same as `/queue` but formatted for OBS overlay |
| `GET` | `/stream/queue/next` | Public *(used by OBS service)* | Atomically grab next item; flips status to `displaying` with row-level lock |
| `POST` | `/stream/queue/advance` | Public *(used by OBS service)* | Body `{ queue_id, screenshot_url? }` — marks displayed, fires `Photo Displayed` event |
| `POST` | `/stream/screenshot` | Public *(used by OBS service)* | Body `{ queue_id, screenshot_base64 }` — composites premium badge if applicable, uploads to S3 |
| `GET` | `/stream/queue/eta/:supporterId` | Public | ETA for a supporter's photo display |
| `GET` | `/stream/queue/count` | Public | Number of waiting items |
| `POST` | `/stream/queue/track-view` | Public | Increment view counter for analytics |
| `GET` | `/stream/youtube-viewers` | Public | Live concurrent viewer count from YouTube Data API |
| `GET` | `/stream/queue/stream` | Public, SSE | 3s-interval SSE of `getQueueDisplay()` |

**Queue priority:** Premium items are displayed before Standard within the same waiting set. Within the same package, items are ordered by `queue_position` ascending. The "grab next" endpoint uses pessimistic write locking to prevent two consumers from picking the same item.

## Fundraising

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/fundraising/stats` | Public | Singleton stats row (total raised, goal, supporter count) |
| `GET` | `/fundraising/recent-supporters` | Public | Last 10 completed photo purchases |
| `GET` | `/fundraising/displayed-photos` | Public | Last 12 displayed photos (with screenshots) |
| `GET` | `/fundraising/prize-count?email=` | Public | Count grand prize entries (optionally filtered by email) |
| `GET` | `/fundraising/stream` | Public, SSE | 3s-interval SSE of stats |
| `PUT` | `/fundraising/stats` | JWT | Manually adjust stats |

## Merchandise

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/merchandise/products` | Public | Active products with variants |
| `GET` | `/merchandise/orders/lookup` | Public | Look up order by email or order number |
| `GET` | `/merchandise/orders/by-session/:sessionId` | Public | Get order by Stripe checkout session id (used by success page) |
| `POST` | `/merchandise/webhooks/printful` | Printful signed | Handles fulfillment status updates |
| `POST` | `/merchandise/sync` | JWT | Sync products from Printful |

## Settings

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/settings` | Public | Public settings (sensitive keys filtered out) |
| `GET` | `/settings/all` | JWT | All settings including secrets |
| `PUT` | `/settings` | JWT | Batch upsert |

**Notable settings:**

| Key | Purpose |
|---|---|
| `moderation_enabled` | Toggle Rekognition (`true`/`false`) |
| `rekognition_min_confidence` | 0-100, default 75 |
| `moderation_fail_open` | If true, approve photos when Rekognition is unavailable |
| `max_reupload_attempts` | Default 3 |
| `premium_badge_enabled` | Toggle premium badge overlay |
| `obs_poll_interval_ms` | OBS service poll frequency (default 3000) |
| `obs_transition_type` | `fade` / `cut` / `slide` |
| `obs_transition_duration_ms` | Transition duration (default 500) |
| `stripe_secret_key`, `stripe_webhook_secret` | Stripe credentials |
| `printful_api_key`, `printful_store_id` | Printful credentials |
| `klaviyo_api_key` | Klaviyo private key |
| `resend_api_key`, `email_from_address`, `email_from_name` | Email sender |
| `youtube_api_key`, `youtube_video_id` | YouTube Data API for viewer counts |
| `fundraising_goal_cents` | Goal amount in cents (default 200000000 = $2M) |
| `stream_queue_paused` | Pause OBS playback without stopping the service |

## Admin Dashboard (all JWT-protected, prefix `/admin`)

The admin module exposes 27 endpoints across:

- `GET /admin/dashboard/overview` — combined stats
- `GET /admin/supporters`, `PUT /admin/supporters/:id`, `POST /admin/supporters/:id/refund`
- `GET /admin/orders`, `PUT /admin/orders/:id/fulfillment`
- `GET /admin/queue` (full), queue control: skip / requeue / swap / clear
- `GET /admin/products`, `POST/PUT/DELETE /admin/products/:id`, `POST /admin/products/upload-image`
- `GET /admin/stats`, `PUT /admin/stats`
- `GET /admin/email-templates`, `PUT /admin/email-templates/:id`
- `POST /admin/notifications/send-email`, `POST /admin/notifications/send-klaviyo-event`
- `GET /admin/customers`, `GET /admin/prize-entries`, `POST /admin/prize-draw`
- `GET /admin/reports/*` — CSV exports for supporters, orders, customers, queue, revenue
- `POST /admin/merchandise/sync`, `POST /admin/merchandise/sync-status`

See Swagger UI for full request/response schemas.

## Klaviyo Events

The backend fires these Klaviyo metric events with full metadata:

### `Photo Purchased`
```jsonc
{
  "name": "Jane Doe",
  "package_type": "standard",
  "amount_dollars": 10,
  "amount_cents": 1000,
  "display_duration_seconds": 10,
  "has_badge": false,
  "queue_position": 14,
  "items_ahead": 13,
  "estimated_display_seconds": 195,
  "estimated_display_at": "2026-04-07T11:45:32.000Z",
  "cumulative_customer_value_dollars": 35,
  "cumulative_customer_value_cents": 3500,
  "photo_purchase_count": 3,
  "merch_purchase_count": 1,
  "prize_entries": 4
}
```

### `Photo Displayed`
Fires when the OBS service calls `/stream/queue/advance`. Includes screenshot URL, actual screen seconds, and full customer cumulative metrics.

### `Photo Rejected`
Fires when moderation rejects a photo on payment completion. Includes `rejection_reason` and `reupload_url` for the customer email.

### `Merchandise Purchased`
```jsonc
{
  "order_number": "ORD-1709...",
  "amount_dollars": 49.5,
  "amount_cents": 4950,
  "subtotal_cents": 4500,
  "shipping_cents": 450,
  "item_count": 2,
  "product_names": ["Burger Tee", "Burger Hat"],
  "cumulative_customer_value_dollars": 79.5,
  "cumulative_customer_value_cents": 7950,
  "photo_purchase_count": 2,
  "merch_purchase_count": 1,
  "prize_entries": 8
}
```

## Server-Sent Events

Two endpoints emit JSON event frames every 3 seconds:

- `GET /api/fundraising/stream` → current `FundraisingStats`
- `GET /api/stream/queue/stream` → `getQueueDisplay()` (current + upcoming + recently displayed)

**Client example:**
```javascript
const evt = new EventSource(`${BASE}/fundraising/stream`);
evt.onmessage = (e) => {
  const stats = JSON.parse(e.data);
  console.log(stats.total_raised_cents);
};
```

## Rate Limiting

Global throttle: **100 requests per 60 seconds per IP** (NestJS Throttler). Returns HTTP 429 when exceeded.

## Error Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Validation errors (DTO with `class-validator`) return 400 with detailed `message` array.
