import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationOauthConnection } from '@docmost/db/types/entity.types';
import {
  decryptString,
  encryptString,
} from '../../common/helpers/encryption.helper';
import { EnvironmentService } from '../environment/environment.service';
import {
  IntegrationConnectionSettingField,
  IntegrationManifest,
  resolveBaseUrl,
} from './manifest.types';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthConnectionRepo } from './integration-oauth-connection.repo';
import { assertAllowedOutboundUrl } from './outbound-url-guard';

const CLIENT_SECRET_ENCRYPTION_INFO = 'integration-oauth-client-secret-v1';

export interface ResolvedIntegrationOAuthConnection {
  integrationId: string;
  providerId: string;
  workspaceId: string;
  enabled: boolean;
  source: 'workspace' | 'env';
  baseUrl: string;
  oauthClientId: string;
  oauthClientSecret?: string;
  /** Manifest-declared connection settings, validated at save time. */
  settings: Record<string, string>;
}

/** Setting field copy exposed to the admin UI (no validation internals). */
export interface PublicIntegrationConnectionSettingField {
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
}

export interface PublicIntegrationOAuthConnection {
  integrationId: string;
  providerId: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  configured: boolean;
  source?: 'workspace' | 'env';
  baseUrl?: string;
  baseUrlPlaceholder?: string;
  oauthClientId?: string;
  hasClientSecret: boolean;
  settings?: Record<string, string>;
  settingsFields: PublicIntegrationConnectionSettingField[];
  redirectUri: string;
  scopes: string[];
}

export interface SaveIntegrationOAuthConnectionInput {
  enabled?: boolean;
  baseUrl: string;
  oauthClientId: string;
  oauthClientSecret?: string | null;
  settings?: Record<string, unknown>;
}

@Injectable()
export class IntegrationOAuthConnectionService {
  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly repo: IntegrationOAuthConnectionRepo,
    private readonly environmentService: EnvironmentService,
    private readonly configService: ConfigService,
  ) {}

  async listAdmin(
    workspaceId: string,
  ): Promise<PublicIntegrationOAuthConnection[]> {
    const rows = await this.repo.listByWorkspace(workspaceId);
    const configured = rows.map((row) => {
      const manifest = this.registry.requireForIntegrationId(row.integrationId);
      return this.toPublicWorkspaceConnection(row, manifest);
    });

    const rowProviderIds = new Set(
      rows.map((row) => this.registry.providerIdFor(row.integrationId)),
    );
    const providerPlaceholders = this.registry
      .list()
      .filter((manifest) => !rowProviderIds.has(manifest.id))
      .map((manifest) => {
        const env = this.resolveEnv(manifest, workspaceId);
        return {
          integrationId: manifest.id,
          providerId: manifest.id,
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          enabled: env?.enabled ?? false,
          configured: !!env,
          source: env?.source,
          baseUrl: env?.baseUrl,
          baseUrlPlaceholder: manifest.baseUrlPlaceholder,
          oauthClientId: env?.oauthClientId,
          hasClientSecret: !!env?.oauthClientSecret,
          settings: env?.settings,
          settingsFields: this.publicSettingsFields(manifest),
          redirectUri: this.callbackUrl(manifest.id),
          scopes: manifest.scopes,
        };
      });

    return [...configured, ...providerPlaceholders];
  }

  async listConfigured(
    workspaceId: string,
  ): Promise<Map<string, ResolvedIntegrationOAuthConnection>> {
    const out = new Map<string, ResolvedIntegrationOAuthConnection>();
    const rows = await this.repo.listByWorkspace(workspaceId);
    const rowProviderIds = new Set<string>();

    for (const row of rows) {
      rowProviderIds.add(this.registry.providerIdFor(row.integrationId));
      const resolved = await this.resolve(workspaceId, row.integrationId);
      if (resolved?.enabled) out.set(row.integrationId, resolved);
    }

    for (const manifest of this.registry.list()) {
      if (rowProviderIds.has(manifest.id)) continue;
      const resolved = await this.resolve(workspaceId, manifest.id);
      if (resolved?.enabled) out.set(manifest.id, resolved);
    }
    return out;
  }

  async resolve(
    workspaceId: string,
    integrationId: string,
  ): Promise<ResolvedIntegrationOAuthConnection | null> {
    const manifest = this.registry.requireForIntegrationId(integrationId);
    const row = await this.repo.find(workspaceId, integrationId);
    if (row) {
      return {
        integrationId,
        providerId: manifest.id,
        workspaceId,
        enabled: row.enabled,
        source: 'workspace',
        baseUrl: row.baseUrl,
        oauthClientId: row.oauthClientId,
        oauthClientSecret: row.oauthClientSecretEncrypted
          ? decryptString(
              row.oauthClientSecretEncrypted,
              this.environmentService.getAppSecret(),
              CLIENT_SECRET_ENCRYPTION_INFO,
            )
          : undefined,
        settings: this.rowSettings(row),
      };
    }
    if (integrationId === manifest.id) {
      return this.resolveEnv(manifest, workspaceId);
    }
    return null;
  }

  async requireEnabled(
    workspaceId: string,
    integrationId: string,
  ): Promise<ResolvedIntegrationOAuthConnection> {
    const resolved = await this.resolve(workspaceId, integrationId);
    if (!resolved?.enabled) {
      throw new BadRequestException(
        `Integration is not configured: ${integrationId}`,
      );
    }
    return resolved;
  }

  async save(
    workspaceId: string,
    integrationId: string,
    actorUserId: string,
    input: SaveIntegrationOAuthConnectionInput,
  ): Promise<PublicIntegrationOAuthConnection> {
    const manifest = this.registry.requireForIntegrationId(integrationId);
    const current = await this.repo.find(workspaceId, integrationId);
    const baseUrl = this.normalizeBaseUrl(input.baseUrl);
    // Fail fast with a friendly 400 when the deployment restricts integration
    // egress; the dial-time guard in outbound-url-guard.ts stays authoritative.
    try {
      await assertAllowedOutboundUrl(baseUrl);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const oauthClientId = input.oauthClientId.trim();
    if (!oauthClientId) {
      throw new BadRequestException('OAuth client ID is required');
    }

    const envSecret = this.resolveEnv(manifest, workspaceId)?.oauthClientSecret;
    let oauthClientSecretEncrypted =
      current?.oauthClientSecretEncrypted ?? null;
    if (
      !current &&
      typeof input.oauthClientSecret === 'undefined' &&
      envSecret
    ) {
      oauthClientSecretEncrypted = encryptString(
        envSecret,
        this.environmentService.getAppSecret(),
        CLIENT_SECRET_ENCRYPTION_INFO,
      );
    }
    if (typeof input.oauthClientSecret !== 'undefined') {
      const raw = input.oauthClientSecret?.trim() ?? '';
      oauthClientSecretEncrypted = raw
        ? encryptString(
            raw,
            this.environmentService.getAppSecret(),
            CLIENT_SECRET_ENCRYPTION_INFO,
          )
        : null;
    }

    const settings = this.normalizeSettings(manifest, input.settings);

    const row = await this.repo.upsert({
      workspaceId,
      integrationId,
      enabled: input.enabled ?? true,
      baseUrl,
      oauthClientId,
      oauthClientSecretEncrypted,
      settings,
      actorUserId,
    });

    return this.toPublicWorkspaceConnection(row, manifest);
  }

  callbackUrl(integrationId: string): string {
    return `${this.environmentService.getAppUrl()}/api/integrations/oauth/${encodeURIComponent(integrationId)}/callback`;
  }

  private toPublicWorkspaceConnection(
    row: IntegrationOauthConnection,
    manifest: IntegrationManifest,
  ): PublicIntegrationOAuthConnection {
    return {
      integrationId: row.integrationId,
      providerId: manifest.id,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      enabled: row.enabled,
      configured: true,
      source: 'workspace',
      baseUrl: row.baseUrl,
      baseUrlPlaceholder: manifest.baseUrlPlaceholder,
      oauthClientId: row.oauthClientId,
      hasClientSecret: !!row.oauthClientSecretEncrypted,
      settings: this.rowSettings(row),
      settingsFields: this.publicSettingsFields(manifest),
      redirectUri: this.callbackUrl(row.integrationId),
      scopes: manifest.scopes,
    };
  }

  /**
   * Validates and normalizes admin-supplied settings against the manifest's
   * declared fields. Unknown keys are dropped; values are trimmed and
   * transformed before the pattern check.
   */
  private normalizeSettings(
    manifest: IntegrationManifest,
    raw: Record<string, unknown> | undefined,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const field of manifest.connectionSettings ?? []) {
      const value = this.normalizeSettingValue(field, raw?.[field.key]);
      if (value !== null) out[field.key] = value;
    }
    return out;
  }

  private normalizeSettingValue(
    field: IntegrationConnectionSettingField,
    raw: unknown,
  ): string | null {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) {
      if (field.required) {
        throw new BadRequestException(`${field.label} is required`);
      }
      return null;
    }
    const value =
      field.transform === 'uppercase'
        ? trimmed.toUpperCase()
        : field.transform === 'lowercase'
          ? trimmed.toLowerCase()
          : trimmed;
    if (field.pattern && !new RegExp(field.pattern).test(value)) {
      throw new BadRequestException(`${field.label} is invalid`);
    }
    return value;
  }

  private publicSettingsFields(
    manifest: IntegrationManifest,
  ): PublicIntegrationConnectionSettingField[] {
    return (manifest.connectionSettings ?? []).map((field) => ({
      key: field.key,
      label: field.label,
      description: field.description,
      placeholder: field.placeholder,
      required: field.required ?? false,
    }));
  }

  private rowSettings(row: IntegrationOauthConnection): Record<string, string> {
    let raw: unknown = row.settings;
    // Tolerate rows persisted as a jsonb string scalar (double-encoded by an
    // earlier driver/serializer combination) by unwrapping one level.
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return {};
      }
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  }

  private resolveEnv(
    manifest: IntegrationManifest,
    workspaceId: string,
  ): ResolvedIntegrationOAuthConnection | null {
    const baseUrl = this.normalizeOptionalBaseUrl(resolveBaseUrl(manifest));
    const oauthClientId =
      this.configService.get<string>(manifest.clientIdEnv) || '';
    if (!baseUrl || !oauthClientId) return null;
    return {
      integrationId: manifest.id,
      providerId: manifest.id,
      workspaceId,
      enabled: true,
      source: 'env',
      baseUrl,
      oauthClientId,
      oauthClientSecret: manifest.clientSecretEnv
        ? this.configService.get<string>(manifest.clientSecretEnv) || undefined
        : undefined,
      settings: {},
    };
  }

  private normalizeOptionalBaseUrl(raw: string): string | null {
    if (!raw) return null;
    try {
      return this.normalizeBaseUrl(raw);
    } catch {
      return null;
    }
  }

  private normalizeBaseUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) throw new BadRequestException('Base URL is required');
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('Base URL must be a valid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Base URL must use http or https');
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  }
}
