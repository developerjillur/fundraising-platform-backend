import OBSWebSocket from 'obs-websocket-js';
import { Config } from './config';

export class ObsController {
  private obs: OBSWebSocket;
  private config: Config;
  private connected = false;

  constructor(config: Config) {
    this.obs = new OBSWebSocket();
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      await this.obs.connect(this.config.obsWsUrl, this.config.obsWsPassword || undefined);
      this.connected = true;
      console.log('[OBS] Connected to OBS WebSocket');

      this.obs.on('ConnectionClosed', () => {
        this.connected = false;
        console.log('[OBS] Connection closed, will retry...');
      });
    } catch (err) {
      console.error('[OBS] Connection failed:', err);
      this.connected = false;
      throw err;
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  async setPhotoSource(imageUrl: string): Promise<void> {
    await this.ensureConnected();
    await this.obs.call('SetInputSettings', {
      inputName: this.config.obsImageSourceName,
      inputSettings: { url: imageUrl },
    });
    console.log(`[OBS] Set photo source to: ${imageUrl}`);
  }

  async setBadgeVisible(visible: boolean): Promise<void> {
    await this.ensureConnected();
    try {
      const { sceneItemId } = await this.obs.call('GetSceneItemId', {
        sceneName: this.config.obsSceneName,
        sourceName: this.config.obsBadgeSourceName,
      });
      await this.obs.call('SetSceneItemEnabled', {
        sceneName: this.config.obsSceneName,
        sceneItemId,
        sceneItemEnabled: visible,
      });
      console.log(`[OBS] Badge visibility: ${visible}`);
    } catch (err) {
      console.warn('[OBS] Could not toggle badge:', err);
    }
  }

  async triggerTransition(): Promise<void> {
    await this.ensureConnected();
    try {
      await this.obs.call('SetCurrentSceneTransition', {
        transitionName: this.config.obsTransitionType === 'cut' ? 'Cut' : 'Fade',
      });
      await this.obs.call('SetCurrentSceneTransitionDuration', {
        transitionDuration: this.config.obsTransitionDurationMs,
      });
    } catch (err) {
      console.warn('[OBS] Transition setting failed:', err);
    }
  }

  async takeScreenshot(): Promise<string | null> {
    await this.ensureConnected();
    try {
      const response = await this.obs.call('GetSourceScreenshot', {
        sourceName: this.config.obsSceneName,
        imageFormat: 'png',
        imageWidth: 1920,
        imageHeight: 1080,
      });
      return response.imageData;
    } catch (err) {
      console.error('[OBS] Screenshot failed:', err);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.obs.disconnect();
      this.connected = false;
    }
  }
}
