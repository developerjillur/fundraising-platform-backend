import { Config } from './config';

export interface QueueItem {
  id: string;
  photo_url: string;
  package_type: 'standard' | 'premium';
  display_duration_seconds: number;
  has_badge: boolean;
  queue_position: number;
  status: string;
  supporter_name: string;
}

export interface QueueResponse {
  status: 'new' | 'displaying' | 'idle' | 'paused';
  item?: QueueItem;
}

export class ApiClient {
  private baseUrl: string;

  constructor(config: Config) {
    this.baseUrl = config.backendApiUrl;
  }

  async getNextQueueItem(): Promise<QueueResponse> {
    const res = await fetch(`${this.baseUrl}/stream/queue/next`);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async advanceQueue(queueId: string, screenshotUrl?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/stream/queue/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId, screenshot_url: screenshotUrl }),
    });
    if (!res.ok) throw new Error(`Advance failed: ${res.status}`);
  }

  async uploadScreenshot(queueId: string, base64Data: string): Promise<{ screenshot_url: string }> {
    const res = await fetch(`${this.baseUrl}/stream/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId, screenshot_base64: base64Data }),
    });
    if (!res.ok) throw new Error(`Screenshot upload failed: ${res.status}`);
    return res.json();
  }

  async trackView(queueId: string, screenTimeSeconds: number): Promise<void> {
    await fetch(`${this.baseUrl}/stream/queue/track-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queueId, screen_time_seconds: screenTimeSeconds }),
    });
  }
}
