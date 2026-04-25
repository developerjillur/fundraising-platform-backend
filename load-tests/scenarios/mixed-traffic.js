import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com';

// Scenario: live YouTube stream with viewers + occasional photo submitters
// Traffic mix: 80% read-only viewers, 15% SSE pollers, 5% photo submitters
export const options = {
  scenarios: {
    viewers: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '1m', target: 400 },
        { duration: '5m', target: 800 },
        { duration: '3m', target: 800 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'viewer',
    },
    sseConsumers: {
      executor: 'constant-vus',
      vus: 150,
      duration: '10m',
      exec: 'sse',
    },
    submitters: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 30 },
        { duration: '3m', target: 0 },
      ],
      exec: 'submitter',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{type:read}': ['p(95)<500'],
    'http_req_duration{type:sse}': ['p(95)<800'],
    'http_req_duration{type:checkout}': ['p(95)<2500'],
  },
};

const readEndpoints = [
  '/api/fundraising/stats',
  '/api/photos/packages',
  '/api/stream/queue/display',
  '/api/fundraising/recent-supporters',
  '/api/stream/youtube-viewers',
];

export function viewer() {
  const url = BASE_URL + readEndpoints[Math.floor(Math.random() * readEndpoints.length)];
  const res = http.get(url, { tags: { type: 'read' } });
  check(res, { 'viewer 200': (r) => r.status === 200 });
  sleep(Math.random() * 5 + 2);
}

export function sse() {
  const url = Math.random() < 0.5
    ? BASE_URL + '/api/fundraising/stats'
    : BASE_URL + '/api/stream/queue/display';
  const res = http.get(url, { tags: { type: 'sse' } });
  check(res, { 'sse 200': (r) => r.status === 200 });
  sleep(3);
}

export function submitter() {
  // Submitters mostly browse; only 1 in 10 tries to checkout
  if (Math.random() < 0.1) {
    const res = http.post(
      `${BASE_URL}/api/payments/checkout/photo`,
      JSON.stringify({
        name: `Submitter ${__VU}`,
        email: `submitter-${__VU}-${Date.now()}@example.com`,
        package_type: Math.random() < 0.7 ? 'standard' : 'premium',
        photo_storage_path: 'photos/loadtest-placeholder.png',
        photo_url: 'https://example.com/loadtest.png',
        moderation_status: 'approved',
        origin: BASE_URL,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { type: 'checkout' },
      },
    );
    check(res, { 'checkout responded': (r) => r.status >= 200 && r.status < 500 });
  } else {
    http.get(`${BASE_URL}/api/photos/packages`, { tags: { type: 'read' } });
  }
  sleep(Math.random() * 8 + 5);
}
