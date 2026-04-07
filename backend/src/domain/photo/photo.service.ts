import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PhotoPackage } from './photo-package.entity';
import { Supporter } from '../fundraising/supporter.entity';
import { S3Service } from '../../common/services/s3.service';
import { ModerationService, ModerationResult } from '../moderation/moderation.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PhotoService {
  constructor(
    @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
    @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
    public readonly s3: S3Service,
    private moderationService: ModerationService,
    private settingsService: SettingsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getActivePackages() {
    return this.packageRepo.find({
      where: { active: true },
      order: { sort_order: 'ASC' },
    });
  }

  async getAllPackages() {
    return this.packageRepo.find({ order: { sort_order: 'ASC' } });
  }

  async getPackage(id: string) {
    return this.packageRepo.findOne({ where: { id } });
  }

  async getPackageBySlug(slug: string) {
    return this.packageRepo.findOne({ where: { slug } });
  }

  async createPackage(data: Partial<PhotoPackage>) {
    const pkg = this.packageRepo.create(data);
    return this.packageRepo.save(pkg);
  }

  async updatePackage(id: string, data: Partial<PhotoPackage>) {
    await this.packageRepo.update(id, data);
    return this.packageRepo.findOne({ where: { id } });
  }

  async deletePackage(id: string) {
    return this.packageRepo.delete(id);
  }

  async saveUploadedFile(file: Express.Multer.File): Promise<{ path: string; url: string }> {
    const { key, url } = await this.s3.upload(
      file.buffer,
      file.originalname,
      'photos',
      file.mimetype,
    );
    return { path: key, url };
  }

  async moderateAndSave(file: Express.Multer.File): Promise<{
    path: string;
    url: string;
    moderation: ModerationResult;
  }> {
    const moderation = await this.moderationService.moderateImage(file.buffer);
    const { key, url } = await this.s3.upload(
      file.buffer,
      file.originalname,
      'photos',
      file.mimetype,
    );
    return { path: key, url, moderation };
  }

  async saveScreenshot(base64Data: string, queueId: string): Promise<string> {
    const buffer = Buffer.from(
      base64Data.replace(/^data:image\/\w+;base64,/, ''),
      'base64',
    );
    const { url } = await this.s3.upload(
      buffer,
      `${queueId}.png`,
      'screenshots',
      'image/png',
    );
    return url;
  }

  async reuploadPhoto(
    supporterId: string,
    file: Express.Multer.File,
  ): Promise<{
    success: boolean;
    moderation_status: string;
    moderation_reason: string | null;
  }> {
    const supporter = await this.supporterRepo.findOne({
      where: { id: supporterId },
    });

    if (!supporter) {
      return { success: false, moderation_status: 'error', moderation_reason: 'Supporter not found' };
    }

    if (supporter.payment_status !== 'completed') {
      return { success: false, moderation_status: 'error', moderation_reason: 'Payment not completed' };
    }

    if (supporter.display_status === 'displayed') {
      return { success: false, moderation_status: 'error', moderation_reason: 'Photo already displayed' };
    }

    // Check re-upload limit
    const maxAttempts = parseInt(
      await this.settingsService.get('max_reupload_attempts', '3'),
      10,
    );
    if (supporter.reupload_count >= maxAttempts) {
      return {
        success: false,
        moderation_status: 'error',
        moderation_reason: `Maximum re-upload attempts (${maxAttempts}) reached`,
      };
    }

    // Moderate the new image
    const moderation = await this.moderationService.moderateImage(file.buffer);

    // Upload to S3
    const { key, url } = await this.s3.upload(
      file.buffer,
      file.originalname,
      'photos',
      file.mimetype,
    );

    // Update supporter record
    supporter.photo_url = url;
    supporter.photo_storage_path = key;
    supporter.moderation_status = moderation.approved ? 'approved' : 'rejected';
    supporter.moderation_reason = moderation.reason;
    supporter.reupload_count = (supporter.reupload_count || 0) + 1;

    // If now approved and not yet queued, add to queue via event
    if (moderation.approved && !supporter.display_status) {
      supporter.display_status = 'queued';
      await this.supporterRepo.save(supporter);
      this.eventEmitter.emit('photo.approved_after_reupload', {
        supporterId: supporter.id,
        photoUrl: url,
        photoStoragePath: key,
        packageType: supporter.package_type,
        displayDurationSeconds: supporter.display_duration_seconds,
      });
    } else {
      await this.supporterRepo.save(supporter);
    }

    return {
      success: true,
      moderation_status: moderation.approved ? 'approved' : 'rejected',
      moderation_reason: moderation.reason,
    };
  }
}
