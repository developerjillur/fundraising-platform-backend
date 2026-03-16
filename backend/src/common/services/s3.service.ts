import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(private config: ConfigService) {
    this.region = this.config.get('AWS_S3_REGION', 'us-east-1');
    this.bucket = this.config.get('AWS_S3_BUCKET', '');

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    folder: string,
    contentType: string,
  ): Promise<{ key: string; url: string }> {
    const ext = originalName.includes('.')
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    const key = `${folder}/${Date.now()}-${uuidv4()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return { key, url };
  }
}
