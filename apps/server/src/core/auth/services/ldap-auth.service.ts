import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Client, type Entry } from 'ldapts';
import { readFileSync } from 'node:fs';
import type { ConnectionOptions } from 'node:tls';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

export interface LdapAuthenticatedIdentity {
  subjectId: string;
  email: string;
  name?: string;
}

@Injectable()
export class LdapAuthService {
  private readonly logger = new Logger(LdapAuthService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async authenticate(
    username: string,
    password: string,
  ): Promise<LdapAuthenticatedIdentity> {
    const config = this.environmentService.getLdapConfig();
    if (!config.enabled) {
      throw new ServiceUnavailableException('LDAP authentication is disabled');
    }

    if (
      !config.url ||
      !config.bindDn ||
      !config.bindPassword ||
      !config.baseDn ||
      !config.userSearchFilter ||
      !config.userIdAttribute
    ) {
      throw new ServiceUnavailableException('LDAP configuration is incomplete');
    }

    if (!username?.trim() || !password) {
      throw new UnauthorizedException('Invalid username or password');
    }

    let client: Client | undefined;
    try {
      const tlsOptions = this.getTlsOptions(config.tlsCaCertPath);
      client = new Client({
        url: config.url,
        timeout: config.searchTimeoutMs,
        connectTimeout: config.connectTimeoutMs,
        ...(config.url?.startsWith('ldaps:') ? { tlsOptions } : {}),
      });

      if (config.startTls) {
        await client.startTLS(tlsOptions);
      }

      await client.bind(config.bindDn, config.bindPassword);

      const escapedUsername = escapeLdapFilterValue(username.trim());
      const filter = config.userSearchFilter.replace(
        /\{\{username\}\}/g,
        escapedUsername,
      );
      const { searchEntries } = await client.search(config.baseDn, {
        scope: 'sub',
        filter,
        attributes: [
          config.userIdAttribute,
          config.userEmailAttribute,
          config.userNameAttribute,
          'cn',
        ],
        sizeLimit: 2,
        timeLimit: Math.max(1, Math.ceil(config.searchTimeoutMs / 1000)),
      });

      if (searchEntries.length !== 1) {
        throw new Error('LDAP user search did not return exactly one entry');
      }

      const entry = searchEntries[0];
      const subjectId = getEntryValue(entry, config.userIdAttribute);
      const email = getEntryValue(entry, config.userEmailAttribute);
      const name =
        getEntryValue(entry, config.userNameAttribute) ??
        getEntryValue(entry, 'cn');

      if (!entry.dn || !subjectId || !email) {
        throw new Error('LDAP user entry is missing required attributes');
      }

      await client.bind(entry.dn, password);
      return { subjectId, email, name };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`LDAP authentication failed (${errorName})`);
      throw new UnauthorizedException('Invalid username or password');
    } finally {
      if (client) {
        try {
          await client.unbind();
        } catch {
          this.logger.debug('Failed to cleanly close LDAP connection');
        }
      }
    }
  }

  private getTlsOptions(caCertPath?: string): ConnectionOptions {
    return {
      rejectUnauthorized: true,
      ...(caCertPath ? { ca: [readFileSync(caCertPath)] } : {}),
    };
  }
}

export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (character) => {
    return `\\${character.charCodeAt(0).toString(16).padStart(2, '0')}`;
  });
}

function getEntryValue(entry: Entry, attribute: string): string | undefined {
  const attributeKey = Object.keys(entry).find(
    (key) => key.toLowerCase() === attribute.toLowerCase(),
  );
  if (!attributeKey) {
    return undefined;
  }

  const value = entry[attributeKey];
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (typeof firstValue === 'string') {
    return firstValue.trim() || undefined;
  }
  if (Buffer.isBuffer(firstValue)) {
    return firstValue.toString('utf8').trim() || undefined;
  }

  return undefined;
}