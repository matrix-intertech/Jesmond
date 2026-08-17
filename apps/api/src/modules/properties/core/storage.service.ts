import { Injectable, InternalServerErrorException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string | undefined;
  private readonly r2PublicUrl: string | undefined;
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    this.bucketName = process.env.S3_BUCKET;
    const region = process.env.S3_REGION || 'auto';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    this.r2PublicUrl = process.env.R2_PUBLIC_URL;

    if (this.bucketName && accessKeyId && secretAccessKey) {
      if (!r2AccountId) {
        this.logger.error('R2_ACCOUNT_ID is missing. Cannot configure Cloudflare R2 securely.');
      } else {
        this.s3Client = new S3Client({
          region,
          endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log('S3/R2 Storage configured successfully.');
      }
    } else {
      this.logger.warn('S3/R2 credentials/bucket not fully configured. Uploads will be disabled.');
    }
  }

  async uploadPropertyImage(propertyId: string, file: Express.Multer.File): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new ServiceUnavailableException('Storage is not configured on this server.');
    }

    const fileExt = file.originalname.split('.').pop();
    const key = `properties/${propertyId}/${randomUUID()}.${fileExt}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      
      if (!this.r2PublicUrl) {
        throw new InternalServerErrorException('R2_PUBLIC_URL is missing. Cannot generate public object URL.');
      }
      // Strip trailing slash if present
      const baseUrl = this.r2PublicUrl.endsWith('/') ? this.r2PublicUrl.slice(0, -1) : this.r2PublicUrl;
      return `${baseUrl}/${key}`;
    } catch (error: any) {
      this.logger.error(`Failed to upload image to S3/R2: ${error.message || error}`, error);
      throw new InternalServerErrorException('Failed to upload image');
    }
  }

  async deleteImage(url: string): Promise<void> {
    if (!this.s3Client || !this.bucketName) return;

    try {
      let key: string | null = null;
      if (url.includes('.amazonaws.com/')) {
        key = url.split('.amazonaws.com/')[1];
      } else if (this.r2PublicUrl && url.startsWith(this.r2PublicUrl)) {
        const baseUrl = this.r2PublicUrl.endsWith('/') ? this.r2PublicUrl : `${this.r2PublicUrl}/`;
        key = url.replace(baseUrl, '');
      } else if (url.includes('/properties/')) {
        // Fallback robust parsing if it's a known format
        key = `properties/${url.split('/properties/')[1]}`;
      }

      if (key) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
      }
    } catch (error) {
      this.logger.error('Failed to delete image from S3/R2', error);
    }
  }
}
