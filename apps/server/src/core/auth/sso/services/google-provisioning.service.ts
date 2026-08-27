import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { AuthProviderGroupMappingRepo } from '@docmost/db/repos/auth-provider/auth-provider-group-mapping.repo';
import {
  AuthProvider,
  AuthProviderGroupMapping,
  User,
  Workspace,
} from '@docmost/db/types/entity.types';
import { UserRole } from '../../../../common/helpers/types/permission';
import { WorkspaceService } from '../../../workspace/services/workspace.service';
import { GroupUserService } from '../../../group/services/group-user.service';
import { nanoIdGen } from '../../../../common/helpers/nanoid.utils';
import { GoogleIdentity } from './google-oauth.service';

/** Thrown when Google identity matches a privileged password account. */
export class PrivilegedLinkBlockedError extends Error {
  constructor() {
    super('Cannot link a Google account to an existing admin account.');
  }
}
import { MembershipSource } from '../sso.constants';

/** Higher wins. Used to make role mapping promote-only. */
const ROLE_RANK: Record<string, number> = {
  [UserRole.MEMBER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.OWNER]: 3,
};

export function rankRole(role: string | null | undefined): number {
  return ROLE_RANK[role ?? ''] ?? 0;
}

/**
 * Picks the role a user should end up with. Only ever promotes: an existing
 * role that already outranks every mapped role is left alone, and owners are
 * never touched, so a mapping change can't lock an admin out.
 */
export function resolveMappedRole(
  currentRole: string,
  mappedRoles: Array<string | null>,
): string | null {
  if (currentRole === UserRole.OWNER) return null;

  const best = mappedRoles
    .filter(Boolean)
    .reduce<string | null>(
      (acc, role) => (rankRole(role) > rankRole(acc) ? role : acc),
      null,
    );

  if (!best) return null;
  return rankRole(best) > rankRole(currentRole) ? best : null;
}

export interface GroupReconciliation {
  toAdd: string[];
  toRemove: string[];
}

/**
 * Works out the membership delta for one Docmost group.
 *
 * `manualMemberIds` are never added-over and never removed — a member an admin
 * added by hand stays put even if they are not in the Google group. Only
 * memberships that sync itself created are reconciled.
 */
export function reconcileGroupMembers(opts: {
  desiredUserIds: string[];
  syncedMemberIds: string[];
  manualMemberIds: string[];
}): GroupReconciliation {
  const desired = new Set(opts.desiredUserIds);
  const synced = new Set(opts.syncedMemberIds);
  const manual = new Set(opts.manualMemberIds);

  const toAdd = [...desired].filter((id) => !synced.has(id) && !manual.has(id));
  const toRemove = [...synced].filter((id) => !desired.has(id));

  return { toAdd, toRemove };
}

@Injectable()
export class GoogleProvisioningService {
  private readonly logger = new Logger(GoogleProvisioningService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
    private readonly groupUserRepo: GroupUserRepo,
    private readonly mappingRepo: AuthProviderGroupMappingRepo,
    private readonly workspaceService: WorkspaceService,
    private readonly groupUserService: GroupUserService,
  ) {}

  /**
   * Finds the Docmost user behind a Google identity, linking or creating one
   * as needed. Returns null when the user does not exist and signup is off.
   */
  async resolveUser(
    identity: GoogleIdentity,
    provider: AuthProvider,
    workspace: Workspace,
  ): Promise<User | null> {
    const linked = await this.db
      .selectFrom('authAccounts')
      .select('userId')
      .where('providerUserId', '=', identity.sub)
      .where('authProviderId', '=', provider.id)
      .executeTakeFirst();

    if (linked) {
      return this.userRepo.findById(linked.userId, workspace.id);
    }

    const existing = await this.userRepo.findByEmail(
      identity.email,
      workspace.id,
    );

    if (existing) {
      // Refuse to take over a privileged account that has its own password.
      // Matching on a verified Google email only proves control of the
      // mailbox, which is a weaker claim than that account's own credentials.
      if (
        !existing.hasGeneratedPassword &&
        (existing.role === UserRole.OWNER || existing.role === UserRole.ADMIN)
      ) {
        throw new PrivilegedLinkBlockedError();
      }

      await this.linkAccount(
        existing.id,
        provider.id,
        identity.sub,
        workspace.id,
      );
      return existing;
    }

    if (!provider.allowSignup) {
      return null;
    }

    return this.provisionUser(identity, provider, workspace);
  }

  /**
   * Raised when a Google identity matches an existing admin/owner who signs in
   * with a password. Linking is refused rather than silently allowed.
   */
  private async linkAccount(
    userId: string,
    authProviderId: string,
    providerUserId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .insertInto('authAccounts')
      .values({ userId, authProviderId, providerUserId, workspaceId })
      .onConflict((oc) => oc.columns(['userId', 'authProviderId']).doNothing())
      .execute();
  }

  private async provisionUser(
    identity: GoogleIdentity,
    provider: AuthProvider,
    workspace: Workspace,
  ): Promise<User> {
    return executeTx(this.db, async (trx) => {
      const user = await this.userRepo.insertUser(
        {
          email: identity.email,
          name: identity.name || identity.email.split('@')[0],
          // insertUser always bcrypt-hashes this, so it cannot be undefined.
          // The account signs in through Google, never with this value.
          password: nanoIdGen(32),
          emailVerifiedAt: new Date(),
          hasGeneratedPassword: true,
          workspaceId: workspace.id,
        },
        trx,
      );

      await this.workspaceService.addUserToWorkspace(
        user.id,
        workspace.id,
        undefined,
        trx,
      );

      await this.groupUserRepo.addUserToDefaultGroup(user.id, workspace.id, trx);

      await trx
        .insertInto('authAccounts')
        .values({
          userId: user.id,
          authProviderId: provider.id,
          providerUserId: identity.sub,
          workspaceId: workspace.id,
        })
        .execute();

      return user;
    });
  }

  /**
   * Applies every mapping whose Google group the user belongs to. Only touches
   * groups that are a mapping target; unmapped groups and the default group
   * are left alone entirely.
   */
  async syncUser(
    user: User,
    provider: AuthProvider,
    googleGroupEmails: string[],
  ): Promise<void> {
    const mappings = await this.mappingRepo.findByProvider(provider.id);
    if (mappings.length === 0) return;

    // An empty result is ambiguous: genuine non-membership looks identical to
    // a scoping or permission misconfiguration. Add-only in that case, so a
    // misconfigured service account cannot strip everyone's groups.
    const removalsAllowed = googleGroupEmails.length > 0;

    const memberOf = new Set(googleGroupEmails.map((e) => e.toLowerCase()));
    const currentGroupIds = new Set(
      await this.groupUserRepo.getUserGroupIds(user.id),
    );

    const matched = mappings.filter((m) =>
      memberOf.has(m.externalGroupKey.toLowerCase()),
    );

    // Several Google groups may target the same Docmost group. Decide per
    // target group, not per mapping, or two mappings would undo each other.
    const desiredGroupIds = new Set(matched.map((m) => m.groupId));
    const mappedGroupIds = new Set(mappings.map((m) => m.groupId));

    for (const groupId of desiredGroupIds) {
      if (currentGroupIds.has(groupId)) continue;
      await this.groupUserService.addUsersToGroupBatch(
        [user.id],
        groupId,
        user.workspaceId,
        undefined,
        { source: MembershipSource.GOOGLE },
      );
    }

    for (const groupId of mappedGroupIds) {
      if (!removalsAllowed) break;
      if (desiredGroupIds.has(groupId)) continue;

      // Drop it only if sync created it; a manual membership stays put.
      const membership = await this.groupUserRepo.getGroupUserById(
        user.id,
        groupId,
      );

      if (membership?.source === MembershipSource.GOOGLE) {
        await this.groupUserService.removeUsersFromGroupBatch(
          [user.id],
          groupId,
        );
      }
    }

    await this.applyRole(user, matched);
  }

  private async applyRole(
    user: User,
    matched: AuthProviderGroupMapping[],
  ): Promise<void> {
    const newRole = resolveMappedRole(
      user.role,
      matched.map((m) => m.role),
    );

    if (!newRole) return;

    await this.userRepo.updateUser(
      { role: newRole },
      user.id,
      user.workspaceId,
    );

    this.logger.log(
      `Promoted ${user.email} to ${newRole} via Google group mapping`,
    );
  }

  /**
   * Reconciles one mapping across every existing Docmost user. Google members
   * without a Docmost account are skipped; they get their groups when they
   * first sign in.
   */
  async syncMapping(
    mapping: AuthProviderGroupMapping,
    memberEmails: string[],
  ): Promise<{ added: number; removed: number; skipped: number }> {
    const normalized = memberEmails.map((e) => e.toLowerCase());

    // See syncUser: an empty member list is not trusted to mean "empty group".
    const removalsAllowed = normalized.length > 0;

    const matchedUsers = normalized.length
      ? await this.db
          .selectFrom('users')
          .select(['id', 'email', 'role'])
          .where('workspaceId', '=', mapping.workspaceId)
          .where('deletedAt', 'is', null)
          .where(sql`lower(email)`, 'in', normalized)
          .execute()
      : [];

    const memberships = await this.db
      .selectFrom('groupUsers')
      .select(['userId', 'source'])
      .where('groupId', '=', mapping.groupId)
      .execute();

    const { toAdd, toRemove } = reconcileGroupMembers({
      desiredUserIds: matchedUsers.map((u) => u.id),
      syncedMemberIds: memberships
        .filter((m) => m.source === MembershipSource.GOOGLE)
        .map((m) => m.userId),
      manualMemberIds: memberships
        .filter((m) => m.source !== MembershipSource.GOOGLE)
        .map((m) => m.userId),
    });

    if (toAdd.length) {
      await this.groupUserService.addUsersToGroupBatch(
        toAdd,
        mapping.groupId,
        mapping.workspaceId,
        undefined,
        { source: MembershipSource.GOOGLE },
      );
    }

    if (removalsAllowed && toRemove.length) {
      await this.groupUserService.removeUsersFromGroupBatch(
        toRemove,
        mapping.groupId,
      );
    }

    if (mapping.role) {
      for (const user of matchedUsers) {
        const newRole = resolveMappedRole(user.role, [mapping.role]);
        if (newRole) {
          await this.userRepo.updateUser(
            { role: newRole },
            user.id,
            mapping.workspaceId,
          );
        }
      }
    }

    return {
      added: toAdd.length,
      removed: removalsAllowed ? toRemove.length : 0,
      skipped: normalized.length - matchedUsers.length,
    };
  }
}
