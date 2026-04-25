import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com';

const sseEvents = new Counter('sse_events_received');

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
  },
};

const sseStreams = [
  '/api/fundraising/stream',
  '/api/stream/queue/stream',
];

// k6 doesn't natively stream SSE — we approximate by long-polling the underlying
// queue/stats endpoints at the SSE cadence (every 3 seconds), which is what
// the SSE handlers do server-side.
export default function () {
  for (let i = 0; i < 5; i++) {
    const url = BASE_URL + sseStreams[Math.floor(Math.random() * sseStreams.length)]
      .replace('/stream', '/display')
      .replace('queue/display', 'queue/display');

    // Simulating the SSE cadence: a connected viewer would pull every ~3s
    const altUrl = url.includes('fundraising')
      ? BASE_URL + '/api/fundraising/stats'
      : BASE_URL + '/api/stream/queue/display';

    const res = http.get(altUrl, { tags: { name: 'sse-poll' } });
    check(res, {
      'sse poll 200': (r) => r.status === 200,
    });
    if (res.status === 200) sseEvents.add(1);
    sleep(3);
  }
}
