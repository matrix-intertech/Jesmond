import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
        this.logger.error(
          'R2_ACCOUNT_ID is missing. Cannot configure Cloudflare R2 securely.',
        );
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
      this.logger.warn(
        'S3/R2 credentials/bucket not fully configured. Uploads will be disabled.',
      );
    }
  }

  async uploadPropertyImage(
    propertyId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new ServiceUnavailableException(
        'Storage is not configured on this server.',
      );
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
        }),
      );

      if (!this.r2PublicUrl) {
        throw new InternalServerErrorException(
          'R2_PUBLIC_URL is missing. Cannot generate public object URL.',
        );
      }
      // Strip trailing slash if present
      const baseUrl = this.r2PublicUrl.endsWith('/')
        ? this.r2PublicUrl.slice(0, -1)
        : this.r2PublicUrl;
      return `${baseUrl}/${key}`;
    } catch (error: any) {
      this.logger.error(
        `Failed to upload image to S3/R2: ${error.message || error}`,
        error,
      );
      throw new InternalServerErrorException('Failed to upload image');
    }
  }

  async uploadRetailProductImage(
    orgId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      // Local development fallback: Since S3 is not configured, we'll write to .tempmediaStorage
      // ONLY IF we are in a dev environment without credentials, to avoid throwing 500s locally.
      // Wait, the prompt says "Reuse the same canonical mechanism". Let's stick strictly to the exact S3 logic.
      throw new ServiceUnavailableException(
        'Storage is not configured on this server.',
      );
    }

    const fileExt = file.originalname.split('.').pop();
    const key = `retail/${orgId}/${randomUUID()}.${fileExt}`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      if (!this.r2PublicUrl) {
        throw new InternalServerErrorException(
          'R2_PUBLIC_URL is missing. Cannot generate public object URL.',
        );
      }
      const baseUrl = this.r2PublicUrl.endsWith('/')
        ? this.r2PublicUrl.slice(0, -1)
        : this.r2PublicUrl;
      return `${baseUrl}/${key}`;
    } catch (error: any) {
      this.logger.error(
        `Failed to upload retail product image to S3/R2: ${error.message || error}`,
        error,
      );
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
        const baseUrl = this.r2PublicUrl.endsWith('/')
          ? this.r2PublicUrl
          : `${this.r2PublicUrl}/`;
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
          }),
        );
      }
    } catch (error) {
      this.logger.error('Failed to delete image from S3/R2', error);
    }
  }

  /**
   * Uploads a private credential document to S3/R2 under the credentials/ prefix.
   * Performs magic bytes verification, MIME checks, and size validation (max 10MB).
   * Strictly isolates files from public CDN exposure.
   */
  async uploadCredentialDocument(
    orgId: string,
    credentialId: string,
    file: Express.Multer.File,
  ): Promise<{ key: string; filename: string; mimeType: string; size: number }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file buffer provided for upload');
    }

    // 1. File size validation (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of 10MB (received ${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
      );
    }

    // 2. MIME type & Magic Byte verification
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file format: ${file.mimetype}. Allowed formats: PDF, PNG, JPG/JPEG.`,
      );
    }

    const buffer = file.buffer;
    let isValidMagic = false;
    if (
      file.mimetype === 'application/pdf' &&
      buffer.length >= 4 &&
      buffer.toString('utf-8', 0, 4) === '%PDF'
    ) {
      isValidMagic = true;
    } else if (
      file.mimetype === 'image/png' &&
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      isValidMagic = true;
    } else if (
      file.mimetype === 'image/jpeg' &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      isValidMagic = true;
    }

    if (!isValidMagic) {
      throw new BadRequestException(
        'File contents do not match the declared MIME type header signature (magic bytes validation failed).',
      );
    }

    const rawExt = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
    const safeExt = ['pdf', 'png', 'jpg', 'jpeg'].includes(rawExt) ? rawExt : 'bin';
    const key = `credentials/${orgId}/${credentialId}/${randomUUID()}.${safeExt}`;

    if (this.s3Client && this.bucketName) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to upload credential document to S3/R2: ${error.message || error}`,
          error,
        );
        throw new InternalServerErrorException('Failed to upload credential document');
      }
    } else {
      this.logger.warn(
        `S3/R2 credentials not configured. Mocking credential storage for key: ${key}`,
      );
    }

    return {
      key,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Uploads a private supporting document for business name change requests to S3/R2.
   * Performs magic bytes verification, MIME checks, and size validation (max 10MB).
   */
  async uploadNameChangeDocument(
    orgId: string,
    requestId: string,
    file: Express.Multer.File,
  ): Promise<{ key: string; filename: string; mimeType: string; size: number }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file buffer provided for upload');
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of 10MB (received ${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
      );
    }

    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file format: ${file.mimetype}. Allowed formats: PDF, PNG, JPG/JPEG.`,
      );
    }

    const buffer = file.buffer;
    let isValidMagic = false;
    if (
      file.mimetype === 'application/pdf' &&
      buffer.length >= 4 &&
      buffer.toString('utf-8', 0, 4) === '%PDF'
    ) {
      isValidMagic = true;
    } else if (
      file.mimetype === 'image/png' &&
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      isValidMagic = true;
    } else if (
      file.mimetype === 'image/jpeg' &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      isValidMagic = true;
    }

    if (!isValidMagic) {
      throw new BadRequestException(
        'File contents do not match the declared MIME type header signature (magic bytes validation failed).',
      );
    }

    const rawExt = file.originalname.split('.').pop()?.toLowerCase() || 'bin';
    const safeExt = ['pdf', 'png', 'jpg', 'jpeg'].includes(rawExt) ? rawExt : 'bin';
    const key = `name-change-requests/${orgId}/${requestId}/${randomUUID()}.${safeExt}`;

    if (this.s3Client && this.bucketName) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to upload name change document to S3/R2: ${error.message || error}`,
          error,
        );
        throw new InternalServerErrorException('Failed to upload name change document');
      }
    } else {
      this.logger.warn(
        `S3/R2 credentials not configured. Mocking name change storage for key: ${key}`,
      );
    }

    return {
      key,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Generates a temporary pre-signed GET URL for downloading private credential documents.
   * Maximum TTL is 15 minutes (900 seconds).
   */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number = 900,
  ): Promise<string> {
    const ttl = Math.min(Math.max(expiresInSeconds, 60), 900); // Max 15 mins (900s)

    if (this.s3Client && this.bucketName) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });
        return await getSignedUrl(this.s3Client as any, command as any, {
          expiresIn: ttl,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to generate presigned download URL for key ${key}: ${error.message || error}`,
          error,
        );
        throw new InternalServerErrorException(
          'Failed to generate secure signed URL for document',
        );
      }
    }

    this.logger.warn(
      `S3 not configured. Returning local signed placeholder for ${key}`,
    );
    return `https://mock-storage.local/${key}?token=${randomUUID()}&expires=${ttl}`;
  }
}
