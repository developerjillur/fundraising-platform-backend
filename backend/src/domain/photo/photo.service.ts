import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhotoPackage } from './photo-package.entity';
import { S3Service } from '../../common/services/s3.service';

@Injectable()
export class PhotoService {
  constructor(
    @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
    private s3: S3Service,
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
}
