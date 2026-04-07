import { loadConfig } from './config';
import { ApiClient, QueueItem } from './api-client';
import { ObsController } from './obs-controller';

const config = loadConfig();
const api = new ApiClient(config);
const obs = new ObsController(config);

let currentItem: QueueItem | null = null;
let displayStartTime: number | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleNewItem(item: QueueItem): Promise<void> {
  console.log(`[MAIN] Displaying: ${item.supporter_name} (${item.package_type}) for ${item.display_duration_seconds}s`);

  await obs.setPhotoSource(item.photo_url);
  await obs.setBadgeVisible(item.has_badge);
  await obs.triggerTransition();

  currentItem = item;
  displayStartTime = Date.now();

  await sleep(item.display_duration_seconds * 1000);

  if (config.screenshotEnabled) {
    try {
      const screenshotBase64 = await obs.takeScreenshot();
      if (screenshotBase64) {
        const result = await api.uploadScreenshot(item.id, screenshotBase64);
        console.log(`[MAIN] Screenshot saved: ${result.screenshot_url}`);
        await api.advanceQueue(item.id, result.screenshot_url);
      } else {
        await api.advanceQueue(item.id);
      }
    } catch (err) {
      console.error('[MAIN] Screenshot/advance error:', err);
      await api.advanceQueue(item.id);
    }
  } else {
    await api.advanceQueue(item.id);
  }

  const screenTime = Math.round((Date.now() - (displayStartTime || Date.now())) / 1000);
  await api.trackView(item.id, screenTime).catch(() => {});

  currentItem = null;
  displayStartTime = null;
  console.log(`[MAIN] Done displaying: ${item.supporter_name}`);
}

async function pollLoop(): Promise<void> {
  console.log('[MAIN] OBS Automation Service starting...');
  console.log(`[MAIN] Backend: ${config.backendApiUrl}`);
  console.log(`[MAIN] Poll interval: ${config.apiPollIntervalMs}ms`);

  let obsConnected = false;
  while (!obsConnected) {
    try {
      await obs.connect();
      obsConnected = true;
    } catch {
      console.log('[MAIN] Retrying OBS connection in 5s...');
      await sleep(5000);
    }
  }

  while (true) {
    try {
      const response = await api.getNextQueueItem();

      switch (response.status) {
        case 'new':
          if (response.item) {
            await handleNewItem(response.item);
          }
          break;
        case 'displaying':
          console.log('[MAIN] Item already displaying, waiting...');
          await sleep(config.apiPollIntervalMs);
          break;
        case 'paused':
          console.log('[MAIN] Queue paused, waiting...');
          await sleep(config.apiPollIntervalMs * 2);
          break;
        case 'idle':
          await sleep(config.apiPollIntervalMs);
          break;
      }
    } catch (err) {
      console.error('[MAIN] Poll error:', err);
      await sleep(config.apiPollIntervalMs);
    }
  }
}

process.on('SIGINT', async () => {
  console.log('[MAIN] Shutting down...');
  await obs.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[MAIN] Shutting down...');
  await obs.disconnect();
  process.exit(0);
});

pollLoop().catch((err) => {
  console.error('[MAIN] Fatal error:', err);
  process.exit(1);
});
