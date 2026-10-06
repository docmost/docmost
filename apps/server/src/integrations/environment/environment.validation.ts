import {
  IsIn,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsISO6391 } from '../../common/validators/is-iso6391';

export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['true', 'false'])
  LDAP_ENABLED: string;

  @ValidateIf((obj) => obj.LDAP_ENABLED === 'true')
  @IsNotEmpty()
  @IsUrl({
    protocols: ['ldap', 'ldaps'],
    require_tld: false,
    allow_underscores: true,
  })
  LDAP_URL: string;

  @ValidateIf((obj) => obj.LDAP_ENABLED === 'true')
  @IsNotEmpty()
  @IsString()
  LDAP_BIND_DN: string;

  @ValidateIf((obj) => obj.LDAP_ENABLED === 'true')
  @IsNotEmpty()
  @IsString()
  LDAP_BIND_PASSWORD: string;

  @ValidateIf((obj) => obj.LDAP_ENABLED === 'true')
  @IsNotEmpty()
  @IsString()
  LDAP_BASE_DN: string;

  @ValidateIf((obj) => obj.LDAP_ENABLED === 'true')
  @IsNotEmpty()
  @Matches(/\{\{username\}\}/)
  LDAP_USER_SEARCH_FILTER: string;

  @ValidateIf((obj) => obj.LDAP_ENABLED === 'true')
  @IsNotEmpty()
  @IsString()
  LDAP_USER_ID_ATTRIBUTE: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  LDAP_USER_EMAIL_ATTRIBUTE: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  LDAP_USER_NAME_ATTRIBUTE: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  LDAP_STARTTLS: string;

  @IsOptional()
  @IsString()
  LDAP_TLS_CA_CERT_PATH: string;

  @IsOptional()
  @Matches(/^[1-9]\d{0,4}$/)
  LDAP_CONNECT_TIMEOUT_MS: string;

  @IsOptional()
  @Matches(/^[1-9]\d{0,4}$/)
  LDAP_SEARCH_TIMEOUT_MS: string;

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
  @IsIn(['local', 's3', 'azure'])
  STORAGE_DRIVER: string;

  @IsOptional()
  @ValidateIf((obj) => obj.COLLAB_URL != '' && obj.COLLAB_URL != null)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  COLLAB_URL: string;

  @IsOptional()
  CLOUD: boolean;

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
  @ValidateIf((obj) => obj.AI_VECTOR_DRIVER)
  @IsIn(['pgvector', 'turbopuffer'])
  @IsString()
  AI_VECTOR_DRIVER: string;

  @ValidateIf((obj) => obj.AI_VECTOR_DRIVER === 'turbopuffer')
  @IsNotEmpty()
  @IsString()
  TURBOPUFFER_API_KEY: string;

  @ValidateIf(
    (obj) =>
      obj.AI_VECTOR_DRIVER === 'turbopuffer' && !obj.TURBOPUFFER_BASE_URL,
  )
  @IsNotEmpty({
    message:
      'TURBOPUFFER_REGION is required when AI_VECTOR_DRIVER is turbopuffer, unless TURBOPUFFER_BASE_URL is set',
  })
  @IsString()
  TURBOPUFFER_REGION: string;

  @IsOptional()
  @ValidateIf((obj) => obj.TURBOPUFFER_BASE_URL != '' && obj.TURBOPUFFER_BASE_URL != null)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  TURBOPUFFER_BASE_URL: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_.]{1,90}$/, {
    message:
      'TURBOPUFFER_NAMESPACE_PREFIX may only contain letters, digits, dot, dash, underscore (max 90 chars)',
  })
  TURBOPUFFER_NAMESPACE_PREFIX: string;

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

export function getLdapEnvironmentErrors(
  config: Record<string, unknown>,
): string[] {
  if (String(config.LDAP_ENABLED).toLowerCase() !== 'true') {
    return [];
  }

  const errors: string[] = [];
  if (String(config.CLOUD).toLowerCase() === 'true') {
    errors.push('LDAP_ENABLED=true is not supported when CLOUD=true');
  }

  let protocol: string;
  try {
    protocol = new URL(String(config.LDAP_URL)).protocol;
  } catch {
    return errors;
  }

  const startTls = String(config.LDAP_STARTTLS).toLowerCase() === 'true';
  if (protocol === 'ldaps:' && startTls) {
    errors.push('LDAP_STARTTLS cannot be enabled with an ldaps:// LDAP_URL');
  }

  const nodeEnv = String(config.NODE_ENV ?? '').toLowerCase();
  if (
    protocol === 'ldap:' &&
    !startTls &&
    nodeEnv !== 'development' &&
    nodeEnv !== 'test'
  ) {
    errors.push('LDAP must use TLS in non-development environments');
  }

  return errors;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig);
  const ldapErrors = getLdapEnvironmentErrors(config);

  if (errors.length > 0 || ldapErrors.length > 0) {
    console.error(
      'The Environment variables has failed the following validations:',
    );

    errors.map((error) => {
      console.error(JSON.stringify(error.constraints));
    });
    ldapErrors.forEach((error) => console.error(error));

    console.error(
      'Please fix the environment variables and try again. Exiting program...',
    );
    process.exit(1);
  }

  return validatedConfig;
}
