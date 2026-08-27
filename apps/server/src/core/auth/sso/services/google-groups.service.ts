import { Inject, Injectable, Logger } from '@nestjs/common';
import { JWT } from 'google-auth-library';
import { request } from 'undici';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EnvironmentService } from '../../../../integrations/environment/environment.service';

const CLOUD_IDENTITY_BASE = 'https://cloudidentity.googleapis.com/v1';
const CLOUD_IDENTITY_SCOPE =
  'https://www.googleapis.com/auth/cloud-identity.groups.readonly';
const DISCUSSION_FORUM_LABEL =
  'cloudidentity.googleapis.com/groups.discussion_forum';

/** How long a user's group list is cached, to keep logins off the network. */
const USER_GROUPS_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class GoogleGroupsService {
  private readonly logger = new Logger(GoogleGroupsService.name);
  private client: JWT | null = null;

  constructor(
    private readonly environmentService: EnvironmentService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  isConfigured(): boolean {
    return this.environmentService.isGoogleGroupSyncConfigured();
  }

  /**
   * A plain service-account JWT client. Cloud Identity authorizes the service
   * account itself through an org-level IAM role, so unlike the Admin SDK
   * there is no `subject` to impersonate and no domain-wide delegation.
   */
  private getClient(): JWT {
    if (this.client) return this.client;

    const raw = this.environmentService.getGoogleServiceAccountKey();
    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    } catch {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY is not valid base64-encoded JSON',
      );
    }

    this.client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [CLOUD_IDENTITY_SCOPE],
    });
    return this.client;
  }

  private async call<T>(url: string): Promise<T> {
    const token = await this.getClient().getAccessToken();
    const res = await request(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token.token}`,
        accept: 'application/json',
      },
    });

    const body = await res.body.json();
    if (res.statusCode >= 400) {
      throw new Error(
        `Cloud Identity request failed (${res.statusCode}): ${JSON.stringify(body)}`,
      );
    }
    return body as T;
  }

  /** Resolves a group email to its Cloud Identity resource name (`groups/xxx`). */
  private async lookupGroupName(groupEmail: string): Promise<string | null> {
    const url = `${CLOUD_IDENTITY_BASE}/groups:lookup?groupKey.id=${encodeURIComponent(
      groupEmail,
    )}`;
    const body = await this.call<{ name?: string }>(url);
    return body?.name ?? null;
  }

  /**
   * Every member email of a Google group. Used by the admin-triggered resync,
   * which reconciles a whole Docmost group at once.
   */
  async listGroupMemberEmails(groupEmail: string): Promise<string[]> {
    const groupName = await this.lookupGroupName(groupEmail);
    if (!groupName) {
      throw new Error(`Google group not found: ${groupEmail}`);
    }

    const emails: string[] = [];
    let pageToken: string | undefined;

    do {
      const url =
        `${CLOUD_IDENTITY_BASE}/${groupName}/memberships?view=FULL&pageSize=500` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');

      const body = await this.call<{
        memberships?: Array<{ preferredMemberKey?: { id?: string } }>;
        nextPageToken?: string;
      }>(url);

      for (const membership of body.memberships ?? []) {
        const id = membership?.preferredMemberKey?.id;
        if (id) emails.push(id.toLowerCase());
      }
      pageToken = body.nextPageToken;
    } while (pageToken);

    return emails;
  }

  /**
   * The Google groups a single user belongs to (transitively, so nested groups
   * count). One call per login rather than one per mapped group.
   */
  async listGroupsForUser(userEmail: string): Promise<string[]> {
    const cacheKey = `google-groups:${userEmail.toLowerCase()}`;
    const cached = await this.cacheManager.get<string[]>(cacheKey);
    if (cached) return cached;

    const query = encodeURIComponent(
      `member_key_id == '${userEmail.toLowerCase()}' && '${DISCUSSION_FORUM_LABEL}' in labels`,
    );

    const groups: string[] = [];
    let pageToken: string | undefined;

    do {
      const url =
        `${CLOUD_IDENTITY_BASE}/groups/-/memberships:searchTransitiveGroups?query=${query}&pageSize=500` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');

      const body = await this.call<{
        memberships?: Array<{ groupKey?: { id?: string } }>;
        nextPageToken?: string;
      }>(url);

      for (const membership of body.memberships ?? []) {
        const id = membership?.groupKey?.id;
        if (id) groups.push(id.toLowerCase());
      }
      pageToken = body.nextPageToken;
    } while (pageToken);

    await this.cacheManager.set(cacheKey, groups, USER_GROUPS_TTL_MS);
    return groups;
  }

  /**
   * Never lets a Google outage block a login: callers get an empty list and
   * sync is skipped for this request.
   */
  async safeListGroupsForUser(userEmail: string): Promise<string[] | null> {
    if (!this.isConfigured()) return null;
    try {
      return await this.listGroupsForUser(userEmail);
    } catch (err: any) {
      this.logger.warn(
        `Skipping Google group sync for ${userEmail}: ${err?.message}`,
      );
      return null;
    }
  }
}
