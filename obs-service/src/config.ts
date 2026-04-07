export interface Config {
  backendApiUrl: string;
  apiPollIntervalMs: number;
  obsWsUrl: string;
  obsWsPassword: string;
  obsSceneName: string;
  obsImageSourceName: string;
  obsBadgeSourceName: string;
  obsTransitionType: string;
  obsTransitionDurationMs: number;
  screenshotEnabled: boolean;
}

export function loadConfig(): Config {
  return {
    backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:3001/api',
    apiPollIntervalMs: parseInt(process.env.API_POLL_INTERVAL_MS || '3000', 10),
    obsWsUrl: process.env.OBS_WS_URL || 'ws://localhost:4455',
    obsWsPassword: process.env.OBS_WS_PASSWORD || '',
    obsSceneName: process.env.OBS_SCENE_NAME || 'PhotoDisplay',
    obsImageSourceName: process.env.OBS_IMAGE_SOURCE_NAME || 'SupporterPhoto',
    obsBadgeSourceName: process.env.OBS_BADGE_SOURCE_NAME || 'PremiumBadge',
    obsTransitionType: process.env.OBS_TRANSITION_TYPE || 'fade',
    obsTransitionDurationMs: parseInt(process.env.OBS_TRANSITION_DURATION_MS || '500', 10),
    screenshotEnabled: process.env.SCREENSHOT_ENABLED !== 'false',
  };
}
