import { Injectable, InternalServerErrorException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string | undefined;
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    this.bucketName = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (this.bucketName && region && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log('S3 Storage configured successfully.');
    } else {
      this.logger.warn('S3 credentials/bucket not fully configured. Uploads will be disabled.');
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
          ACL: 'public-read',
        })
      );
      
      // We assume standard S3 URL format here
      return `https://${this.bucketName}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
    } catch (error) {
      this.logger.error('Failed to upload image to S3', error);
      throw new InternalServerErrorException('Failed to upload image');
    }
  }

  async deleteImage(url: string): Promise<void> {
    if (!this.s3Client || !this.bucketName) return;

    try {
      // Extract the key from the standard URL
      const keyParts = url.split('.amazonaws.com/');
      if (keyParts.length === 2) {
        const key = keyParts[1];
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
      }
    } catch (error) {
      this.logger.error('Failed to delete image from S3', error);
      // We don't throw here to avoid blocking database deletion if S3 fails or is unconfigured
    }
  }
}
