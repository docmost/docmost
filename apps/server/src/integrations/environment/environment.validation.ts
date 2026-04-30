import {
  IsIn,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsISO6391 } from '../../common/validators/is-iso6391';

export class EnvironmentVariables {
  @IsNotEmpty()
  @IsUrl(
    {
      protocols: ['postgres', 'postgresql'],
      require_tld: false,
      allow_underscores: true,
    },
    { message: 'DATABASE_URL must be a valid postgres connection string' },
  )
  DATABASE_URL: string;

  @IsNotEmpty()
  @IsUrl(
    {
      protocols: ['redis', 'rediss'],
      require_tld: false,
      allow_underscores: true,
    },
    { message: 'REDIS_URL must be a valid redis connection string' },
  )
  REDIS_URL: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  APP_URL: string;

  @IsNotEmpty()
  @MinLength(32)
  @IsNotIn(['REPLACE_WITH_LONG_SECRET'])
  APP_SECRET: string;

  @IsOptional()
  @IsIn(['smtp', 'postmark'])
  MAIL_DRIVER: string;

  @IsOptional()
  @IsIn(['local', 's3'])
  STORAGE_DRIVER: string;

  @IsOptional()
  @ValidateIf((obj) => obj.COLLAB_URL != '' && obj.COLLAB_URL != null)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  COLLAB_URL: string;

  @IsOptional()
  CLOUD: boolean;

  @IsOptional()
  @IsIn(['true', 'false'])
  @IsString()
  FORWARD_AUTH_ENABLED: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  @IsString()
  OAUTH_ENABLED: string;

  @IsOptional()
  @ValidateIf((obj) => obj.OAUTH_ENABLED === 'true')
  @IsIn(['gitea', 'azure'])
  @IsString()
  OAUTH_PROVIDER: string;

  @IsOptional()
  @IsString()
  OAUTH_PROVIDERS: string;

  @IsOptional()
  @ValidateIf((obj) => obj.OAUTH_ENABLED === 'true' && !obj.OAUTH_PROVIDERS)
  @IsString()
  @IsNotEmpty()
  OAUTH_CLIENT_ID: string;

  @IsOptional()
  @ValidateIf((obj) => obj.OAUTH_ENABLED === 'true' && !obj.OAUTH_PROVIDERS)
  @IsString()
  @IsNotEmpty()
  OAUTH_CLIENT_SECRET: string;

  @IsOptional()
  @ValidateIf((obj) => obj.OAUTH_ENABLED === 'true' && !obj.OAUTH_PROVIDERS)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  OAUTH_ISSUER_URL: string;

  @IsOptional()
  @ValidateIf((obj) => obj.OAUTH_ENABLED === 'true' && !obj.OAUTH_PROVIDERS)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  OAUTH_CALLBACK_URL: string;

  @IsOptional()
  @IsString()
  GITEA_OAUTH_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  GITEA_OAUTH_CLIENT_SECRET: string;

  @IsOptional()
  @ValidateIf(
    (obj) =>
      obj.GITEA_OAUTH_ISSUER_URL != '' && obj.GITEA_OAUTH_ISSUER_URL != null,
  )
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  GITEA_OAUTH_ISSUER_URL: string;

  @IsOptional()
  @ValidateIf(
    (obj) =>
      obj.GITEA_OAUTH_CALLBACK_URL != '' &&
      obj.GITEA_OAUTH_CALLBACK_URL != null,
  )
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  GITEA_OAUTH_CALLBACK_URL: string;

  @IsOptional()
  @IsString()
  AZURE_OAUTH_CLIENT_ID: string;

  @IsOptional()
  @IsString()
  AZURE_OAUTH_CLIENT_SECRET: string;

  @IsOptional()
  @ValidateIf(
    (obj) =>
      obj.AZURE_OAUTH_ISSUER_URL != '' && obj.AZURE_OAUTH_ISSUER_URL != null,
  )
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  AZURE_OAUTH_ISSUER_URL: string;

  @IsOptional()
  @ValidateIf(
    (obj) =>
      obj.AZURE_OAUTH_CALLBACK_URL != '' &&
      obj.AZURE_OAUTH_CALLBACK_URL != null,
  )
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  AZURE_OAUTH_CALLBACK_URL: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  @IsString()
  OAUTH_AUTO_PROVISION: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  @IsString()
  FORWARD_AUTH_AUTO_PROVISION: string;

  @IsOptional()
  @IsString()
  FORWARD_AUTH_EMAIL_HEADER: string;

  @IsOptional()
  @IsString()
  FORWARD_AUTH_NAME_HEADER: string;

  @IsOptional()
  @IsString()
  FORWARD_AUTH_USER_HEADER: string;

  @IsOptional()
  @IsString()
  FORWARD_AUTH_SECRET: string;

  @IsOptional()
  @IsString()
  FORWARD_AUTH_SECRET_HEADER: string;

  @IsOptional()
  @IsUrl(
    { protocols: [], require_tld: true },
    {
      message:
        'SUBDOMAIN_HOST must be a valid FQDN domain without the http protocol. e.g example.com',
    },
  )
  @ValidateIf((obj) => obj.CLOUD === 'true'.toLowerCase())
  SUBDOMAIN_HOST: string;

  @IsOptional()
  @IsIn(['database', 'typesense'])
  @IsString()
  SEARCH_DRIVER: string;

  @IsOptional()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_tld: false,
      allow_underscores: true,
    },
    {
      message:
        'TYPESENSE_URL must be a valid typesense url e.g http://localhost:8108',
    },
  )
  @ValidateIf((obj) => obj.SEARCH_DRIVER === 'typesense')
  TYPESENSE_URL: string;

  @ValidateIf((obj) => obj.SEARCH_DRIVER === 'typesense')
  @IsNotEmpty()
  @IsString()
  TYPESENSE_API_KEY: string;

  @IsOptional()
  @ValidateIf((obj) => obj.SEARCH_DRIVER === 'typesense')
  @IsISO6391()
  @IsString()
  TYPESENSE_LOCALE: string;

  @IsOptional()
  @ValidateIf((obj) => obj.AI_DRIVER)
  @IsIn(['openai', 'openai-compatible', 'gemini', 'ollama'])
  @IsString()
  AI_DRIVER: string;

  @IsOptional()
  @IsString()
  AI_EMBEDDING_MODEL: string;

  @ValidateIf((obj) => obj.AI_EMBEDDING_DIMENSION)
  @IsIn(['768', '1024', '1536', '2000', '3072'])
  @IsString()
  AI_EMBEDDING_DIMENSION: string;

  @IsOptional()
  @ValidateIf((obj) => obj.AI_EMBEDDING_SUPPORTS_MRL)
  @IsIn(['true', 'false'])
  @IsString()
  AI_EMBEDDING_SUPPORTS_MRL: string;

  @ValidateIf((obj) => obj.AI_DRIVER)
  @IsString()
  @IsNotEmpty()
  AI_COMPLETION_MODEL: string;

  @IsOptional()
  @ValidateIf(
    (obj) =>
      obj.AI_DRIVER && ['openai', 'openai-compatible'].includes(obj.AI_DRIVER),
  )
  @IsString()
  @IsNotEmpty()
  OPENAI_API_KEY: string;

  @IsOptional()
  @ValidateIf(
    (obj) =>
      obj.AI_DRIVER === 'openai-compatible' ||
      (obj.AI_DRIVER === 'openai' && obj.OPENAI_API_URL),
  )
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  OPENAI_API_URL: string;

  @ValidateIf((obj) => obj.AI_DRIVER && obj.AI_DRIVER === 'gemini')
  @IsString()
  @IsNotEmpty()
  GEMINI_API_KEY: string;

  @ValidateIf((obj) => obj.AI_DRIVER && obj.AI_DRIVER === 'ollama')
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  OLLAMA_API_URL: string;

  @IsOptional()
  @IsIn(['postgres', 'clickhouse'])
  @IsString()
  EVENT_STORE_DRIVER: string;

  @ValidateIf((obj) => obj.EVENT_STORE_DRIVER === 'clickhouse')
  @IsNotEmpty()
  @IsUrl(
    { protocols: ['http', 'https'], require_tld: false },
    {
      message:
        'CLICKHOUSE_URL must be a valid URL e.g http://user:password@localhost:8123/docmost',
    },
  )
  CLICKHOUSE_URL: string;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig);
  const oauthErrors = validateOAuthProviders(config);

  if (errors.length > 0 || oauthErrors.length > 0) {
    console.error(
      'The Environment variables has failed the following validations:',
    );

    errors.map((error) => {
      console.error(JSON.stringify(error.constraints));
    });
    oauthErrors.map((error) => console.error(error));

    console.error(
      'Please fix the environment variables and try again. Exiting program...',
    );
    process.exit(1);
  }

  return validatedConfig;
}

function validateOAuthProviders(config: Record<string, any>) {
  if (config.OAUTH_ENABLED !== 'true' || !config.OAUTH_PROVIDERS) {
    return [];
  }

  const supportedProviders = ['gitea', 'azure'];
  const providers = String(config.OAUTH_PROVIDERS)
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);

  const errors: string[] = [];
  for (const provider of providers) {
    if (!supportedProviders.includes(provider)) {
      errors.push(
        `OAUTH_PROVIDERS contains unsupported provider "${provider}". Supported providers: ${supportedProviders.join(', ')}`,
      );
      continue;
    }

    const prefix = provider.toUpperCase();
    const missingKeys = ['CLIENT_ID', 'CLIENT_SECRET', 'ISSUER_URL'].filter(
      (key) =>
        !config[`${prefix}_OAUTH_${key}`] && !config[`OAUTH_${prefix}_${key}`],
    );

    if (missingKeys.length > 0) {
      errors.push(
        `${prefix} OAuth config is incomplete. Missing: ${missingKeys
          .map((key) => `${prefix}_OAUTH_${key}`)
          .join(', ')}`,
      );
    }
  }

  return errors;
}
