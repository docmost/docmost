"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ms_1 = require("ms");
let EnvironmentService = class EnvironmentService {
    constructor(configService) {
        this.configService = configService;
    }
    getNodeEnv() {
        return this.configService.get('NODE_ENV', 'development');
    }
    isDevelopment() {
        return this.getNodeEnv() === 'development';
    }
    getAppUrl() {
        const rawUrl = this.configService.get('APP_URL') ||
            `http://localhost:${this.getPort()}`;
        const { origin } = new URL(rawUrl);
        return origin;
    }
    isHttps() {
        const appUrl = this.configService.get('APP_URL');
        try {
            const url = new URL(appUrl);
            return url.protocol === 'https:';
        }
        catch (error) {
            return false;
        }
    }
    getSubdomainHost() {
        return this.configService.get('SUBDOMAIN_HOST');
    }
    getPort() {
        return parseInt(this.configService.get('PORT', '3000'));
    }
    getAppSecret() {
        return this.configService.get('APP_SECRET');
    }
    getDatabaseURL() {
        return this.configService.get('DATABASE_URL');
    }
    getDatabaseMaxPool() {
        return parseInt(this.configService.get('DATABASE_MAX_POOL', '10'));
    }
    getRedisUrl() {
        return this.configService.get('REDIS_URL', 'redis://localhost:6379');
    }
    getJwtTokenExpiresIn() {
        return this.configService.get('JWT_TOKEN_EXPIRES_IN', '90d');
    }
    getCookieExpiresIn() {
        const expiresInStr = this.getJwtTokenExpiresIn();
        let msUntilExpiry;
        try {
            msUntilExpiry = (0, ms_1.default)(expiresInStr);
        }
        catch (err) {
            msUntilExpiry = (0, ms_1.default)('90d');
        }
        return new Date(Date.now() + msUntilExpiry);
    }
    getGotenbergUrl() {
        return this.configService.get('GOTENBERG_URL');
    }
    getStorageDriver() {
        return this.configService.get('STORAGE_DRIVER', 'local');
    }
    getFileUploadSizeLimit() {
        return this.configService.get('FILE_UPLOAD_SIZE_LIMIT', '50mb');
    }
    getFileImportSizeLimit() {
        return this.configService.get('FILE_IMPORT_SIZE_LIMIT', '200mb');
    }
    getAwsS3AccessKeyId() {
        return this.configService.get('AWS_S3_ACCESS_KEY_ID');
    }
    getAwsS3SecretAccessKey() {
        return this.configService.get('AWS_S3_SECRET_ACCESS_KEY');
    }
    getAwsS3Region() {
        return this.configService.get('AWS_S3_REGION');
    }
    getAwsS3Bucket() {
        return this.configService.get('AWS_S3_BUCKET');
    }
    getAwsS3Endpoint() {
        return this.configService.get('AWS_S3_ENDPOINT');
    }
    getAwsS3ForcePathStyle() {
        const forcePathStyle = this.configService
            .get('AWS_S3_FORCE_PATH_STYLE', 'false')
            .toLowerCase();
        return forcePathStyle === 'true';
    }
    getAwsS3Url() {
        return this.configService.get('AWS_S3_URL');
    }
    getAzureStorageAccountName() {
        return this.configService.get('AZURE_STORAGE_ACCOUNT_NAME');
    }
    getAzureStorageContainer() {
        return this.configService.get('AZURE_STORAGE_CONTAINER');
    }
    getAzureStorageAccountKey() {
        return this.configService.get('AZURE_STORAGE_ACCOUNT_KEY');
    }
    getAzureStorageEndpoint() {
        return this.configService.get('AZURE_STORAGE_ENDPOINT');
    }
    getAzureStorageUrl() {
        return this.configService.get('AZURE_STORAGE_URL');
    }
    getMailDriver() {
        return this.configService.get('MAIL_DRIVER', 'log');
    }
    getMailFromAddress() {
        return this.configService.get('MAIL_FROM_ADDRESS');
    }
    getMailFromName() {
        return this.configService.get('MAIL_FROM_NAME', 'Docmost');
    }
    getMailBlockedRecipientDomains() {
        const raw = this.configService.get('MAIL_BLOCKED_RECIPIENT_DOMAINS', '');
        return raw
            .split(',')
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean);
    }
    getSmtpHost() {
        return this.configService.get('SMTP_HOST');
    }
    getSmtpPort() {
        return parseInt(this.configService.get('SMTP_PORT'));
    }
    getSmtpSecure() {
        const secure = this.configService
            .get('SMTP_SECURE', 'false')
            .toLowerCase();
        return secure === 'true';
    }
    getSmtpIgnoreTLS() {
        const ignoretls = this.configService
            .get('SMTP_IGNORETLS', 'false')
            .toLowerCase();
        return ignoretls === 'true';
    }
    getSmtpUsername() {
        return this.configService.get('SMTP_USERNAME');
    }
    getSmtpPassword() {
        return this.configService.get('SMTP_PASSWORD');
    }
    getPostmarkToken() {
        return this.configService.get('POSTMARK_TOKEN');
    }
    getDrawioUrl() {
        return this.configService.get('DRAWIO_URL');
    }
    isCloud() {
        const cloudConfig = this.configService
            .get('CLOUD', 'false')
            .toLowerCase();
        return cloudConfig === 'true';
    }
    isSelfHosted() {
        return !this.isCloud();
    }
    getStripePublishableKey() {
        return this.configService.get('STRIPE_PUBLISHABLE_KEY');
    }
    getStripeSecretKey() {
        return this.configService.get('STRIPE_SECRET_KEY');
    }
    getStripeWebhookSecret() {
        return this.configService.get('STRIPE_WEBHOOK_SECRET');
    }
    getBillingTrialDays() {
        return parseInt(this.configService.get('BILLING_TRIAL_DAYS', '14'));
    }
    getCollabUrl() {
        return this.configService.get('COLLAB_URL');
    }
    isCollabDisableRedis() {
        const isStandalone = this.configService
            .get('COLLAB_DISABLE_REDIS', 'false')
            .toLowerCase();
        return isStandalone === 'true';
    }
    isDisableTelemetry() {
        const disable = this.configService
            .get('DISABLE_TELEMETRY', 'false')
            .toLowerCase();
        return disable === 'true';
    }
    getPostHogHost() {
        return this.configService.get('POSTHOG_HOST');
    }
    getPostHogKey() {
        return this.configService.get('POSTHOG_KEY');
    }
    getSearchDriver() {
        return this.configService
            .get('SEARCH_DRIVER', 'database')
            .toLowerCase();
    }
    getTypesenseUrl() {
        return this.configService
            .get('TYPESENSE_URL', 'http://localhost:8108')
            .toLowerCase();
    }
    getTypesenseApiKey() {
        return this.configService.get('TYPESENSE_API_KEY');
    }
    getTypesenseLocale() {
        return this.configService
            .get('TYPESENSE_LOCALE', 'en')
            .toLowerCase();
    }
    getAiDriver() {
        return this.configService.get('AI_DRIVER');
    }
    getAiEmbeddingModel() {
        return this.configService.get('AI_EMBEDDING_MODEL');
    }
    getAiCompletionModel() {
        return this.configService.get('AI_COMPLETION_MODEL');
    }
    getAiChatModel() {
        return (this.configService.get('AI_CHAT_MODEL') ||
            this.configService.get('AI_COMPLETION_MODEL'));
    }
    getAiEmbeddingDimension() {
        return parseInt(this.configService.get('AI_EMBEDDING_DIMENSION'), 10);
    }
    getAiEmbeddingSupportsMrl() {
        const val = this.configService.get('AI_EMBEDDING_SUPPORTS_MRL');
        if (val === undefined || val === null || val === '')
            return undefined;
        return val === 'true';
    }
    getOpenAiApiKey() {
        return this.configService.get('OPENAI_API_KEY');
    }
    getOpenAiApiUrl() {
        return this.configService.get('OPENAI_API_URL');
    }
    getGeminiApiKey() {
        return this.configService.get('GEMINI_API_KEY');
    }
    getOllamaApiUrl() {
        return this.configService.get('OLLAMA_API_URL', 'http://localhost:11434');
    }
    getEventStoreDriver() {
        return this.configService
            .get('EVENT_STORE_DRIVER', 'postgres')
            .toLowerCase();
    }
    getClickHouseUrl() {
        return this.configService.get('CLICKHOUSE_URL');
    }
    getSamlDisableRequestedAuthnContext() {
        const disabled = this.configService
            .get('SAML_DISABLE_REQUESTED_AUTHN_CONTEXT', 'false')
            .toLowerCase();
        return disabled === 'true';
    }
    isIframeEmbedAllowed() {
        const allowed = this.configService
            .get('IFRAME_EMBED_ALLOWED', 'false')
            .toLowerCase();
        return allowed === 'true';
    }
    getIframeAllowedOrigins() {
        const raw = this.configService.get('IFRAME_ALLOWED_ORIGINS', '');
        return raw
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);
    }
};
exports.EnvironmentService = EnvironmentService;
exports.EnvironmentService = EnvironmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EnvironmentService);
//# sourceMappingURL=environment.service.js.map