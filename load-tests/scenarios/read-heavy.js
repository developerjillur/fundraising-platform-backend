import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

const endpoints = [
  '/api/health',
  '/api/fundraising/stats',
  '/api/fundraising/recent-supporters',
  '/api/fundraising/displayed-photos',
  '/api/photos/packages',
  '/api/stream/queue',
  '/api/stream/queue/display',
  '/api/stream/queue/count',
  '/api/settings',
];

export default function () {
  const url = BASE_URL + endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(url);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'body present': (r) => r.body && r.body.length > 0,
  });
  sleep(Math.random() * 2 + 1);
}
