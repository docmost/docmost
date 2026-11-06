import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';

@Injectable()
export class EnvironmentService {
  constructor(private configService: ConfigService) {}

  getNodeEnv(): string {
    return this.getConfigValue('NODE_ENV', 'development');
  }

  isDevelopment(): boolean {
    return this.getNodeEnv() === 'development';
  }

  getAppUrl(): string {
    const rawUrl =
      this.getConfigValue('APP_URL') || `http://localhost:${this.getPort()}`;

    const { origin } = new URL(rawUrl);
    return origin;
  }

  isHttps(): boolean {
    const appUrl = this.getConfigValue('APP_URL');
    try {
      const url = new URL(appUrl);
      return url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  getSubdomainHost(): string {
    return this.getConfigValue('SUBDOMAIN_HOST');
  }

  getPort(): number {
    return parseInt(this.getConfigValue('PORT', '3000'));
  }

  getAppSecret(): string {
    return this.getConfigValue('APP_SECRET');
  }

  getDatabaseURL(): string {
    return this.getConfigValue('DATABASE_URL');
  }

  getDatabaseMaxPool(): number {
    return parseInt(this.getConfigValue('DATABASE_MAX_POOL', '10'));
  }

  getRedisUrl(): string {
    return this.getConfigValue('REDIS_URL', 'redis://localhost:6379');
  }

  getJwtTokenExpiresIn(): string {
    return this.getConfigValue('JWT_TOKEN_EXPIRES_IN', '90d');
  }

  getCookieExpiresIn(): Date {
    const expiresInStr = this.getJwtTokenExpiresIn();
    let msUntilExpiry: number;
    try {
      msUntilExpiry = ms(expiresInStr as StringValue);
    } catch (err) {
      msUntilExpiry = ms('90d');
    }
    return new Date(Date.now() + msUntilExpiry);
  }

  getGotenbergUrl(): string | undefined {
    return this.getConfigValue('GOTENBERG_URL');
  }

  getStorageDriver(): string {
    return this.getConfigValue('STORAGE_DRIVER', 'local');
  }

  getFileUploadSizeLimit(): string {
    return this.getConfigValue('FILE_UPLOAD_SIZE_LIMIT', '50mb');
  }

  getFileImportSizeLimit(): string {
    return this.getConfigValue('FILE_IMPORT_SIZE_LIMIT', '200mb');
  }

  getAwsS3AccessKeyId(): string {
    return this.getConfigValue('AWS_S3_ACCESS_KEY_ID');
  }

  getAwsS3SecretAccessKey(): string {
    return this.getConfigValue('AWS_S3_SECRET_ACCESS_KEY');
  }

  getAwsS3Region(): string {
    return this.getConfigValue('AWS_S3_REGION');
  }

  getAwsS3Bucket(): string {
    return this.getConfigValue('AWS_S3_BUCKET');
  }

  getAwsS3Endpoint(): string {
    return this.getConfigValue('AWS_S3_ENDPOINT');
  }

  getAwsS3ForcePathStyle(): boolean {
    const forcePathStyle = this.getConfigValue(
      'AWS_S3_FORCE_PATH_STYLE',
      'false',
    ).toLowerCase();
    return forcePathStyle === 'true';
  }

  getAwsS3Url(): string {
    return this.getConfigValue('AWS_S3_URL');
  }

  getAzureStorageAccountName(): string {
    return this.getConfigValue('AZURE_STORAGE_ACCOUNT_NAME');
  }

  getAzureStorageContainer(): string {
    return this.getConfigValue('AZURE_STORAGE_CONTAINER');
  }

  getAzureStorageAccountKey(): string {
    return this.getConfigValue('AZURE_STORAGE_ACCOUNT_KEY');
  }

  getAzureStorageEndpoint(): string {
    return this.getConfigValue('AZURE_STORAGE_ENDPOINT');
  }

  getAzureStorageUrl(): string {
    return this.getConfigValue('AZURE_STORAGE_URL');
  }

  getMailDriver(): string {
    return this.getConfigValue('MAIL_DRIVER', 'log');
  }

  getMailFromAddress(): string {
    return this.getConfigValue('MAIL_FROM_ADDRESS');
  }

  getMailFromName(): string {
    return this.getConfigValue('MAIL_FROM_NAME', 'Docmost');
  }

  getMailBlockedRecipientDomains(): string[] {
    const raw = this.getConfigValue('MAIL_BLOCKED_RECIPIENT_DOMAINS', '');
    return raw
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }

  getSmtpHost(): string {
    return this.getConfigValue('SMTP_HOST');
  }

  getSmtpPort(): number {
    return parseInt(this.getConfigValue('SMTP_PORT'));
  }

  getSmtpSecure(): boolean {
    const secure = this.getConfigValue('SMTP_SECURE', 'false').toLowerCase();
    return secure === 'true';
  }

  getSmtpIgnoreTLS(): boolean {
    const ignoretls = this.getConfigValue(
      'SMTP_IGNORETLS',
      'false',
    ).toLowerCase();
    return ignoretls === 'true';
  }

  getSmtpUsername(): string {
    return this.getConfigValue('SMTP_USERNAME');
  }

  getSmtpPassword(): string {
    return this.getConfigValue('SMTP_PASSWORD');
  }

  getPostmarkToken(): string {
    return this.getConfigValue('POSTMARK_TOKEN');
  }

  getDrawioUrl(): string {
    return this.getConfigValue('DRAWIO_URL');
  }

  isCloud(): boolean {
    const cloudConfig = this.getConfigValue('CLOUD', 'false').toLowerCase();
    return cloudConfig === 'true';
  }

  isSelfHosted(): boolean {
    return !this.isCloud();
  }

  getStripePublishableKey(): string {
    return this.getConfigValue('STRIPE_PUBLISHABLE_KEY');
  }

  getStripeSecretKey(): string {
    return this.getConfigValue('STRIPE_SECRET_KEY');
  }

  getStripeWebhookSecret(): string {
    return this.getConfigValue('STRIPE_WEBHOOK_SECRET');
  }

  getBillingTrialDays(): number {
    return parseInt(this.getConfigValue('BILLING_TRIAL_DAYS', '14'));
  }

  getCollabUrl(): string {
    return this.getConfigValue('COLLAB_URL');
  }

  isCollabDisableRedis(): boolean {
    const isStandalone = this.getConfigValue(
      'COLLAB_DISABLE_REDIS',
      'false',
    ).toLowerCase();
    return isStandalone === 'true';
  }

  isDisableTelemetry(): boolean {
    const disable = this.getConfigValue(
      'DISABLE_TELEMETRY',
      'false',
    ).toLowerCase();
    return disable === 'true';
  }

  isBetaPublicSpaces(): boolean {
    const enabled = this.getConfigValue(
      'BETA_PUBLIC_SPACES',
      'false',
    ).toLowerCase();
    return enabled === 'true';
  }

  getPostHogHost(): string {
    return this.getConfigValue('POSTHOG_HOST');
  }

  getPostHogKey(): string {
    return this.getConfigValue('POSTHOG_KEY');
  }

  getSearchDriver(): string {
    return this.getConfigValue('SEARCH_DRIVER', 'database').toLowerCase();
  }

  getTypesenseUrl(): string {
    return this.getConfigValue(
      'TYPESENSE_URL',
      'http://localhost:8108',
    ).toLowerCase();
  }

  getTypesenseApiKey(): string {
    return this.getConfigValue('TYPESENSE_API_KEY');
  }

  getTypesenseLocale(): string {
    return this.getConfigValue('TYPESENSE_LOCALE', 'en').toLowerCase();
  }

  getAiDriver(): string {
    return this.getConfigValue('AI_DRIVER');
  }

  getAiEmbeddingModel(): string {
    return this.getConfigValue('AI_EMBEDDING_MODEL');
  }

  getAiCompletionModel(): string {
    return this.getConfigValue('AI_COMPLETION_MODEL');
  }

  getAiChatModel(): string {
    return (
      this.getConfigValue('AI_CHAT_MODEL') ||
      this.getConfigValue('AI_COMPLETION_MODEL')
    );
  }

  getAiEmbeddingDimension(): number {
    return parseInt(this.getConfigValue('AI_EMBEDDING_DIMENSION'), 10);
  }

  getAiEmbeddingSupportsMrl(): boolean | undefined {
    const val = this.getConfigValue('AI_EMBEDDING_SUPPORTS_MRL');
    if (val === undefined || val === null || val === '') return undefined;
    return val === 'true';
  }

  getAiVectorDriver(): string {
    return this.getConfigValue('AI_VECTOR_DRIVER', 'pgvector').toLowerCase();
  }

  getTurbopufferApiKey(): string {
    return this.getConfigValue('TURBOPUFFER_API_KEY');
  }

  getTurbopufferRegion(): string {
    return this.getConfigValue('TURBOPUFFER_REGION');
  }

  getTurbopufferBaseUrl(): string {
    return this.getConfigValue('TURBOPUFFER_BASE_URL');
  }

  getTurbopufferNamespacePrefix(): string {
    return this.getConfigValue('TURBOPUFFER_NAMESPACE_PREFIX', 'docmost');
  }

  getOpenAiApiKey(): string {
    return this.getConfigValue('OPENAI_API_KEY');
  }

  getOpenAiApiUrl(): string {
    return this.getConfigValue('OPENAI_API_URL');
  }

  getGeminiApiKey(): string {
    return this.getConfigValue('GEMINI_API_KEY');
  }

  getOllamaApiUrl(): string {
    return this.getConfigValue('OLLAMA_API_URL', 'http://localhost:11434');
  }

  getEventStoreDriver(): string {
    return this.getConfigValue('EVENT_STORE_DRIVER', 'postgres').toLowerCase();
  }

  getClickHouseUrl(): string {
    return this.getConfigValue('CLICKHOUSE_URL');
  }

  getSamlDisableRequestedAuthnContext(): boolean {
    const disabled = this.getConfigValue(
      'SAML_DISABLE_REQUESTED_AUTHN_CONTEXT',
      'false',
    ).toLowerCase();
    return disabled === 'true';
  }

  isIframeEmbedAllowed(): boolean {
    const allowed = this.getConfigValue(
      'IFRAME_EMBED_ALLOWED',
      'false',
    ).toLowerCase();
    return allowed === 'true';
  }

  getIframeAllowedOrigins(): string[] {
    const raw = this.getConfigValue('IFRAME_ALLOWED_ORIGINS', '');
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  getSlackSigningSecret(): string | undefined {
    return this.getConfigValue('INTEGRATION_SLACK_SIGNING_SECRET');
  }

  getAllowedPrivateNetworks(): string {
    return this.getConfigValue('ALLOWED_PRIVATE_NETWORKS', 'none');
  }

  private getConfigValue(key: string, defaultValue?: string): string {
    return this.configService.get<string>(key) || defaultValue;
  }
}
