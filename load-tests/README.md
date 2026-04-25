# Load Testing — Burger Fundraising Platform

k6 scripts for stress-testing the production API. These scenarios mimic the traffic
pattern expected during a live YouTube stream event.

## Prerequisites

```bash
# Install k6 (Linux / macOS / Windows)
# https://k6.io/docs/getting-started/installation/

# Linux:
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6

# macOS:
brew install k6
```

## Target

By default, scripts hit the production ALB:

```
http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com
```

Override with the `BASE_URL` environment variable:

```bash
k6 run -e BASE_URL=http://localhost:3000 scenarios/sse-readers.js
```

## Scenarios

| Script | What it tests | Use case |
|---|---|---|
| `scenarios/read-heavy.js` | Public GET endpoints (stats, queue, packages) | Stream viewers refreshing the page |
| `scenarios/sse-readers.js` | SSE connections to fundraising and queue streams | Many viewers watching real-time updates |
| `scenarios/photo-checkout.js` | Photo upload → checkout creation flow | Viewers submitting photos during stream |
| `scenarios/mixed-traffic.js` | Combines all scenarios at realistic ratios | End-to-end live event simulation |

## Running

```bash
# Read-heavy traffic — 200 concurrent users for 5 minutes
k6 run scenarios/read-heavy.js

# SSE stress — 500 connected viewers for 3 minutes
k6 run scenarios/sse-readers.js

# Photo upload spike — 50 users, ramping over 2 minutes
k6 run scenarios/photo-checkout.js

# Realistic live-event mix — 1000 users, 10 minutes
k6 run scenarios/mixed-traffic.js
```

## Reading results

k6 prints a summary at the end. Key metrics:

- **`http_req_duration p(95)`** — 95th percentile response time. Target: under 500ms for reads, under 1.5s for checkout.
- **`http_req_failed`** — error rate. Target: under 1%.
- **`vus`** — concurrent virtual users.
- **`iterations`** — total requests.

## Thresholds

Each script defines pass/fail thresholds. If they're exceeded, `k6 run` exits non-zero
so this can be wired into CI. See each script's `thresholds:` block for specifics.
