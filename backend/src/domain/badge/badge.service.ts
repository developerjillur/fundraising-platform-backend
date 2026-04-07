import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);
  private badgePath: string;

  constructor() {
    // Try dist path first, then source path
    const distPath = path.join(__dirname, 'assets', 'premium-badge.png');
    const srcPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'domain',
      'badge',
      'assets',
      'premium-badge.png',
    );

    if (fs.existsSync(distPath)) {
      this.badgePath = distPath;
    } else if (fs.existsSync(srcPath)) {
      this.badgePath = srcPath;
    } else {
      this.badgePath = distPath;
      this.logger.warn(
        `Premium badge not found at ${distPath} or ${srcPath}`,
      );
    }
  }

  async compositeScreenshotWithBadge(
    screenshotBuffer: Buffer,
  ): Promise<Buffer> {
    if (!fs.existsSync(this.badgePath)) {
      this.logger.warn('Badge file missing, returning original screenshot');
      return screenshotBuffer;
    }

    const metadata = await sharp(screenshotBuffer).metadata();
    const width = metadata.width || 1920;

    const badgeSize = Math.round(width * 0.06);
    const margin = Math.round(width * 0.02);

    const resizedBadge = await sharp(this.badgePath)
      .resize(badgeSize, badgeSize)
      .toBuffer();

    return sharp(screenshotBuffer)
      .composite([
        {
          input: resizedBadge,
          top: margin,
          left: width - badgeSize - margin,
        },
      ])
      .png()
      .toBuffer();
  }
}
