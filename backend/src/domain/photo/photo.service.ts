import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhotoPackage } from './photo-package.entity';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PhotoService {
  private uploadDir = path.join(process.cwd(), 'uploads', 'photos');

  constructor(
    @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

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
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${uuidv4()}${ext}`;
    const filepath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    return {
      path: `uploads/photos/${filename}`,
      url: `/uploads/photos/${filename}`,
    };
  }

  async saveScreenshot(base64Data: string, queueId: string): Promise<string> {
    const screenshotDir = path.join(process.cwd(), 'uploads', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const filename = `${queueId}-${Date.now()}.png`;
    const filepath = path.join(screenshotDir, filename);
    const buffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    fs.writeFileSync(filepath, buffer);
    return `/uploads/screenshots/${filename}`;
  }
}
