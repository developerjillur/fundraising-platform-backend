import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SiteSetting } from './site-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SiteSetting) private settingsRepo: Repository<SiteSetting>,
    private configService: ConfigService,
  ) {}

  async getAll(): Promise<Record<string, string>> {
    const settings = await this.settingsRepo.find();
    const map: Record<string, string> = {};
    settings.forEach((s) => { map[s.key] = s.value ?? ''; });
    return map;
  }

  async getPublicSettings(): Promise<Record<string, string>> {
    const all = await this.getAll();
    const sensitiveKeys = ['stripe_secret_key', 'stripe_webhook_secret', 'klaviyo_api_key', 'printful_api_key', 'youtube_api_key', 'resend_api_key', 'moderation_api_key'];
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(all)) {
      if (!sensitiveKeys.some((sk) => k.includes(sk))) {
        filtered[k] = v;
      }
    }
    return filtered;
  }

  async get(key: string, fallback = ''): Promise<string> {
    const setting = await this.settingsRepo.findOne({ where: { key } });
    return setting?.value ?? fallback;
  }

  async set(key: string, value: string, category = 'general'): Promise<void> {
    const existing = await this.settingsRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      await this.settingsRepo.save(existing);
    } else {
      await this.settingsRepo.save({ key, value, category });
    }
  }

  async batchUpsert(settings: Record<string, string>, category = 'general'): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.set(key, value, category);
    }
  }

  async getStripeSecretKey(): Promise<string> {
    return (await this.get('stripe_secret_key')) || this.configService.get('STRIPE_SECRET_KEY', '');
  }

  async getStripeWebhookSecret(): Promise<string> {
    return (await this.get('stripe_webhook_secret')) || this.configService.get('STRIPE_WEBHOOK_SECRET', '');
  }

  async getKlaviyoApiKey(): Promise<string> {
    return (await this.get('klaviyo_api_key')) || this.configService.get('KLAVIYO_API_KEY', '');
  }

  async getPrintfulApiKey(): Promise<string> {
    return (await this.get('printful_api_key')) || this.configService.get('PRINTFUL_API_KEY', '');
  }

  async getPrintfulStoreId(): Promise<string> {
    return (await this.get('printful_store_id')) || this.configService.get('PRINTFUL_STORE_ID', '');
  }

  async getResendApiKey(): Promise<string> {
    return (await this.get('resend_api_key')) || this.configService.get('RESEND_API_KEY', '');
  }

  async getEmailFrom(): Promise<{ address: string; name: string }> {
    return {
      address: (await this.get('email_from_address')) || this.configService.get('EMAIL_FROM_ADDRESS', 'noreply@example.com'),
      name: (await this.get('email_from_name')) || this.configService.get('EMAIL_FROM_NAME', 'The Last McDonalds Burger'),
    };
  }

  async getYoutubeApiKey(): Promise<string> {
    return (await this.get('youtube_api_key')) || this.configService.get('YOUTUBE_API_KEY', '');
  }

  async getModerationApiKey(): Promise<string> {
    return (await this.get('moderation_api_key')) || this.configService.get('MODERATION_API_KEY', '');
  }
}
