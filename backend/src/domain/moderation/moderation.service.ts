import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';
import { SettingsService } from '../settings/settings.service';

export interface ModerationResult {
  approved: boolean;
  reason: string | null;
  labels: Array<{ name: string; confidence: number }>;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private rekognition: RekognitionClient;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    this.rekognition = new RekognitionClient({
      region: this.configService.get('AWS_S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
    const enabled = await this.settingsService.get(
      'moderation_enabled',
      'false',
    );
    if (enabled !== 'true') {
      return { approved: true, reason: null, labels: [] };
    }

    const minConfidence =
      await this.settingsService.getRekognitionMinConfidence();

    try {
      const command = new DetectModerationLabelsCommand({
        Image: { Bytes: imageBuffer },
        MinConfidence: minConfidence,
      });

      const response = await this.rekognition.send(command);
      const labels = (response.ModerationLabels || []).map((l) => ({
        name: l.Name || 'Unknown',
        confidence: l.Confidence || 0,
      }));

      if (labels.length > 0) {
        const topLabel = labels[0];
        return {
          approved: false,
          reason: `Content flagged: ${topLabel.name} (${topLabel.confidence.toFixed(1)}% confidence)`,
          labels,
        };
      }

      return { approved: true, reason: null, labels: [] };
    } catch (error) {
      this.logger.error('Rekognition moderation failed', error);
      // Fail open: if Rekognition is down, approve the image
      return { approved: true, reason: null, labels: [] };
    }
  }
}
