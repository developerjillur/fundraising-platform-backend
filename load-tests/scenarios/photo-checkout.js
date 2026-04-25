import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com';

// Tiny 1x1 transparent PNG used to exercise the upload path without hitting Rekognition limits hard.
// (Rekognition silently rejects micro-images, but the moderation service fails-open so it still works.)
const TEST_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const testPng = new SharedArray('photo', () => {
  // Decode once, share across VUs
  const bytes = atob(TEST_PNG_B64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return [arr.buffer];
});

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:upload}': ['p(95)<3000'],
    'http_req_duration{name:checkout}': ['p(95)<2000'],
  },
};

export default function () {
  const vu = __VU;
  const iter = __ITER;
  const email = `loadtest-${vu}-${iter}@example.com`;
  const name = `Load Test User ${vu}-${iter}`;

  // 1. Upload photo
  const uploadRes = http.post(
    `${BASE_URL}/api/photos/upload`,
    {
      file: http.file(testPng[0], `test-${vu}-${iter}.png`, 'image/png'),
    },
    { tags: { name: 'upload' } },
  );
  check(uploadRes, {
    'upload 200/201': (r) => r.status === 200 || r.status === 201,
    'upload returned url': (r) => {
      try {
        return JSON.parse(r.body).url || JSON.parse(r.body).path;
      } catch { return false; }
    },
  });

  let photoStoragePath, photoUrl, moderationStatus;
  try {
    const body = JSON.parse(uploadRes.body);
    photoStoragePath = body.path;
    photoUrl = body.url;
    moderationStatus = body.moderation_status;
  } catch {
    sleep(2);
    return;
  }

  if (!photoStoragePath) {
    sleep(2);
    return;
  }

  // 2. Create checkout session
  const checkoutRes = http.post(
    `${BASE_URL}/api/payments/checkout/photo`,
    JSON.stringify({
      name,
      email,
      package_type: Math.random() < 0.7 ? 'standard' : 'premium',
      photo_storage_path: photoStoragePath,
      photo_url: photoUrl,
      moderation_status: moderationStatus || 'approved',
      origin: BASE_URL,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'checkout' },
    },
  );
  check(checkoutRes, {
    'checkout 200/201': (r) => r.status === 200 || r.status === 201,
    'checkout returned url': (r) => {
      try { return JSON.parse(r.body).url; } catch { return false; }
    },
  });

  sleep(Math.random() * 3 + 2);
}
