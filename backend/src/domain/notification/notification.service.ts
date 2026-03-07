import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './email-template.entity';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(EmailTemplate) private templateRepo: Repository<EmailTemplate>,
    private settingsService: SettingsService,
  ) {}

  async sendTemplateEmail(templateKey: string, toEmail: string, toName: string, variables: Record<string, string>) {
    const template = await this.templateRepo.findOne({ where: { template_key: templateKey, enabled: true } });
    if (!template) {
      this.logger.warn(`Email template '${templateKey}' not found or disabled`);
      return { skipped: true };
    }

    const resendKey = await this.settingsService.getResendApiKey();
    if (!resendKey) {
      this.logger.warn('Resend API key not configured, skipping email');
      return { skipped: true };
    }

    let subject = template.subject;
    let html = template.body_html;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      html = html.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    const from = await this.settingsService.getEmailFrom();

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${from.name} <${from.address}>`,
          to: [toEmail],
          subject,
          html,
        }),
      });
      const data = await res.json();
      return { sent: true, id: data.id };
    } catch (e) {
      this.logger.error('Failed to send email', e);
      return { error: e.message };
    }
  }

  async sendKlaviyoEvent(eventName: string, email: string, firstName: string, properties: Record<string, any>) {
    const apiKey = await this.settingsService.getKlaviyoApiKey();
    if (!apiKey) {
      this.logger.warn('Klaviyo API key not configured');
      return { skipped: true };
    }

    try {
      const res = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          'Content-Type': 'application/json',
          revision: '2024-02-15',
        },
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              metric: { data: { type: 'metric', attributes: { name: eventName } } },
              profile: {
                data: {
                  type: 'profile',
                  attributes: {
                    email,
                    first_name: firstName,
                  },
                },
              },
              properties,
            },
          },
        }),
      });
      return { sent: true, status: res.status };
    } catch (e) {
      this.logger.error('Klaviyo event failed', e);
      return { error: e.message };
    }
  }

  async getTemplates() {
    return this.templateRepo.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async updateTemplate(id: string, data: Partial<EmailTemplate>) {
    await this.templateRepo.update(id, data);
    return this.templateRepo.findOne({ where: { id } });
  }
}
