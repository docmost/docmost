import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  constructor(private configService: ConfigService) {}

  getEnv(): string {
    return this.configService.get<string>('NODE_ENV');
  }

  getPort(): number {
    return parseInt(this.configService.get<string>('PORT'));
  }
  getDatabaseURL(): string {
    return this.configService.get<string>('DATABASE_URL');
  }

  getJwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET_KEY');
  }

  getJwtTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_TOKEN_EXPIRES_IN');
  }

  getStorageDriver(): string {
    return this.configService.get<string>('STORAGE_DRIVER');
  }

  getLocalStoragePath(): string {
    return this.configService.get<string>('LOCAL_STORAGE_PATH');
  }

  getAwsS3AccessKeyId(): string {
    return this.configService.get<string>('AWS_S3_ACCESS_KEY_ID');
  }

  getAwsS3SecretAccessKey(): string {
    return this.configService.get<string>('AWS_S3_SECRET_ACCESS_KEY');
  }

  getAwsS3Region(): string {
    return this.configService.get<string>('AWS_S3_REGION');
  }

  getAwsS3Bucket(): string {
    return this.configService.get<string>('AWS_S3_BUCKET');
  }

  getAwsS3Endpoint(): string {
    return this.configService.get<string>('AWS_S3_ENDPOINT');
  }

  getAwsS3Url(): string {
    return this.configService.get<string>('AWS_S3_URL');
  }

  getAwsS3UsePathStyleEndpoint(): boolean {
    return this.configService.get<boolean>('AWS_S3_USE_PATH_STYLE_ENDPOINT');
  }

  isCloud(): boolean {
    const cloudConfig = this.configService
      .get<string>('CLOUD', 'false')
      .toLowerCase();
    return cloudConfig === 'true';
  }

  isSelfHosted(): boolean {
    return !this.isCloud();
  }

  getMailDriver(): string {
    return this.configService.get<string>('MAIL_DRIVER', 'log');
  }

  getMailHost(): string {
    return this.configService.get<string>('MAIL_HOST', '127.0.0.1');
  }

  getMailPort(): number {
    return parseInt(this.configService.get<string>('MAIL_PORT'));
  }

  getMailUsername(): string {
    return this.configService.get<string>('MAIL_USERNAME');
  }

  getMailPassword(): string {
    return this.configService.get<string>('MAIL_PASSWORD');
  }

  getMailFromAddress(): string {
    return this.configService.get<string>('MAIL_FROM_ADDRESS');
  }

  getMailFromName(): string {
    return this.configService.get<string>('MAIL_FROM_NAME');
  }

  getPostmarkToken(): string {
    return this.configService.get<string>('POSTMARK_TOKEN');
  }
}
