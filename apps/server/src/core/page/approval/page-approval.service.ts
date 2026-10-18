import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { validate as isValidUUID } from 'uuid';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx, executeTx } from '@docmost/db/utils';
import { Page, User } from '@docmost/db/types/entity.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageDraftRepo } from '@docmost/db/repos/page/page-draft.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceRole } from '../../../common/helpers/types/permission';
import {
  ApprovalContent,
  ApprovalPage,
  ApprovalState,
} from './page-approval.types';
import {
  buildApprovalState,
  effectiveDraftTitleIcon,
  isSpaceControlledRow,
  mergeApproverIds,
  readSpaceApprovalSettings,
} from './page-approval.utils';

@Injectable()
export class PageApprovalService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pageDraftRepo: PageDraftRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async getState(
    page: ApprovalPage,
    trx?: KyselyTransaction,
  ): Promise<ApprovalState> {
    const [row] = await this.selectStateRows([page.id], trx);
    // A missing page has no draft or verification left to protect.
    return buildApprovalState(row ?? { isBase: page.isBase });
  }

  async getEffectiveApproverIds(
    page: ApprovalPage,
    state?: ApprovalState,
  ): Promise<string[]> {
    const approval = state ?? (await this.getState(page));
    const [spaceApproverIds, pageVerifierIds] = await Promise.all([
      approval.spaceRequiresApproval
        ? this.findActiveSpaceApproverIds(page.id)
        : [],
      this.findActiveQmsVerifierIds(page.id),
    ]);
    return mergeApproverIds(
      spaceApproverIds,
      pageVerifierIds,
      approval.spaceRequiresApproval,
    );
  }

  async canEditPage(userId: string, page: ApprovalPage): Promise<boolean> {
    const { canEdit } = await this.resolvePageAccess(userId, page);
    return canEdit;
  }

  async canAccessDraft(
    user: Pick<User, 'id'>,
    page: ApprovalPage,
    state?: ApprovalState,
  ): Promise<boolean> {
    const { spaceRole, canEdit } = await this.resolvePageAccess(user.id, page);
    if (!spaceRole) return false;
    if (canEdit) return true;

    if (!(await this.isEffectiveApprover(user.id, page, state))) return false;

    return this.pagePermissionRepo.canUserAccessPage(user.id, page.id, {
      skipCache: true,
    });
  }

  // canAccessDraft for many users in a fixed number of queries; edit access on uncontrolled pages.
  async getUserIdsWithDraftAccess(
    page: ApprovalPage,
    candidateUserIds: string[],
    state?: ApprovalState,
  ): Promise<string[]> {
    const userIds = [...new Set(candidateUserIds)];
    if (userIds.length === 0) return [];

    const [spaceRoles, pageAccess, approverIds] = await Promise.all([
      this.spaceMemberRepo.getUsersSpaceRoles(userIds, page.spaceId),
      this.pagePermissionRepo.canUsersEditPage(page.id, userIds),
      this.getControlledApproverIds(page, state),
    ]);

    const rolesByUser = new Map<string, typeof spaceRoles>();
    for (const row of spaceRoles) {
      rolesByUser.set(row.userId, [...(rolesByUser.get(row.userId) ?? []), row]);
    }
    const approvers = new Set(approverIds);

    return userIds.filter((userId) => {
      const spaceRole = findHighestUserSpaceRole(rolesByUser.get(userId));
      if (!spaceRole) return false;

      const { hasAnyRestriction, canAccess, canEdit } = pageAccess.get(userId);
      if (hasAnyRestriction && !canAccess) return false;
      if (hasAnyRestriction ? canEdit : spaceRole !== SpaceRole.READER) {
        return true;
      }
      return approvers.has(userId);
    });
  }

  // Counts as draft access only for users already checked to view the page.
  async isEffectiveApprover(
    userId: string,
    page: ApprovalPage,
    state?: ApprovalState,
  ): Promise<boolean> {
    const approverIds = await this.getEffectiveApproverIds(page, state);
    return approverIds.includes(userId);
  }

  async isWorkflowManager(
    user: Pick<User, 'id'>,
    page: ApprovalPage,
    state?: ApprovalState,
  ): Promise<boolean> {
    const spaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      page.spaceId,
      { skipCache: true },
    );
    if (findHighestUserSpaceRole(spaceRoles) === SpaceRole.ADMIN) return true;

    return this.isEffectiveApprover(user.id, page, state);
  }

  async isHiddenFromUser(
    userId: string,
    page: ApprovalPage,
    state?: ApprovalState,
  ): Promise<boolean> {
    const [approval, hiddenAncestorId] = await Promise.all([
      state ?? this.getState(page),
      this.pagePermissionRepo.findHiddenUnpublishedAncestor(userId, page.id),
    ]);
    // The SQL check counts every space writer as a draft user, even a page-level reader of a restricted page.
    if (!hiddenAncestorId && !approval.unpublished) return false;

    return !(await this.canAccessDraft({ id: userId }, page, approval));
  }

  async readContentFor(
    user: Pick<User, 'id'>,
    page: Page & { content?: any },
  ): Promise<ApprovalContent> {
    const state = await this.getState(page);

    if (state.controlled && (await this.canAccessDraft(user, page, state))) {
      const draft = await this.pageDraftRepo.findByPageId(page.id, {
        includeContent: true,
      });
      if (draft) {
        return {
          content: draft.content,
          ...effectiveDraftTitleIcon(draft, page),
          isDraft: true,
        };
      }
    }

    return {
      content: page.content,
      title: page.title,
      icon: page.icon,
      isDraft: false,
    };
  }

  async divertNewPages(
    pageIds: string[],
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    const uniqueIds = [...new Set(pageIds)];
    if (uniqueIds.length === 0) return [];

    return executeTx(
      this.db,
      async (tx) => {
        const rows = await this.selectStateRows(uniqueIds, tx);
        // Pages with a qms row keep their own draft and reader version.
        const divertedIds = rows
          .filter((row) => {
            const state = buildApprovalState(row);
            return state.controlled && !state.verificationId;
          })
          .map((row) => row.id)
          .sort();
        if (divertedIds.length === 0) return [];

        for (const pageId of divertedIds) {
          await this.pageDraftRepo.createFromPage(pageId, tx);
        }
        // Unpublished pages keep title and icon on the page itself.
        await this.pageDraftRepo.moveTitleIconToPages(divertedIds, tx);
        await this.pageRepo.updatePages(
          {
            content: null,
            textContent: null,
            ydoc: null,
            readerVersionId: null,
          },
          divertedIds,
          tx,
        );

        return divertedIds;
      },
      trx,
    );
  }

  // Editors chose the verifiers of an expiring row, so they never become approvers.
  async convertExpiringToSpaceControl(
    pageIds: string[],
    trx: KyselyTransaction,
  ): Promise<string[]> {
    if (pageIds.length === 0) return [];

    const converted = await trx
      .updateTable('pageVerifications')
      .set({
        type: 'qms',
        source: 'space',
        status: 'draft',
        mode: null,
        periodAmount: null,
        periodUnit: null,
        verifiedAt: null,
        verifiedById: null,
        expiresAt: null,
        data: null,
        updatedAt: new Date(),
      })
      .where('pageId', 'in', pageIds)
      .where('type', '=', 'expiring')
      .returning('id')
      .execute();

    const verificationIds = converted.map((row) => row.id);
    if (verificationIds.length > 0) {
      await trx
        .deleteFrom('pageVerifiers')
        .where('pageVerificationId', 'in', verificationIds)
        .execute();
    }
    return verificationIds;
  }

  // In an approval space the space approvers apply, so page approvers chosen elsewhere are dropped.
  async removePageApprovers(
    pageIds: string[],
    trx: KyselyTransaction,
  ): Promise<string[]> {
    if (pageIds.length === 0) return [];

    const removed = await trx
      .deleteFrom('pageVerifiers')
      .using('pageVerifications')
      .whereRef('pageVerifications.id', '=', 'pageVerifiers.pageVerificationId')
      .where('pageVerifications.pageId', 'in', pageIds)
      .where('pageVerifications.type', '=', 'qms')
      .returning('pageVerifiers.userId')
      .execute();

    return [...new Set(removed.map((row) => row.userId))];
  }

  // Pages that lose approval control when they leave a space that requires approval.
  async findSpaceControlledPageIds(
    pageIds: string[],
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const rows = await this.selectStateRows([...new Set(pageIds)], trx);
    return rows.filter(isSpaceControlledRow).map((row) => row.id);
  }

  private async getControlledApproverIds(
    page: ApprovalPage,
    state?: ApprovalState,
  ): Promise<string[]> {
    const approval = state ?? (await this.getState(page));
    return approval.controlled
      ? this.getEffectiveApproverIds(page, approval)
      : [];
  }

  // The collab getAccess rule, minus its trashed-page downgrade.
  private async resolvePageAccess(
    userId: string,
    page: ApprovalPage,
  ): Promise<{ spaceRole: string | undefined; canEdit: boolean }> {
    const [spaceRoles, { hasAnyRestriction, canAccess, canEdit }] =
      await Promise.all([
        this.spaceMemberRepo.getUserSpaceRoles(userId, page.spaceId, {
          skipCache: true,
        }),
        this.pagePermissionRepo.canUserEditPage(userId, page.id, {
          skipCache: true,
        }),
      ]);

    const spaceRole = findHighestUserSpaceRole(spaceRoles);
    if (!spaceRole || (hasAnyRestriction && !canAccess)) {
      return { spaceRole, canEdit: false };
    }

    return {
      spaceRole,
      canEdit: hasAnyRestriction ? canEdit : spaceRole !== SpaceRole.READER,
    };
  }

  private selectStateRows(pageIds: string[], trx?: KyselyTransaction) {
    return dbOrTx(this.db, trx)
      .selectFrom('pages')
      .leftJoin('pageVerifications', 'pageVerifications.pageId', 'pages.id')
      .leftJoin('spaces', 'spaces.id', 'pages.spaceId')
      .select([
        'pages.id',
        'pages.isBase',
        'pages.readerVersionId',
        'pageVerifications.id as verificationId',
        'pageVerifications.type as verificationType',
        'pageVerifications.status as verificationStatus',
        'pageVerifications.source as verificationSource',
        'pageVerifications.pendingHistoryId',
        'spaces.settings as spaceSettings',
      ])
      .where('pages.id', 'in', pageIds)
      .execute();
  }

  private async findActiveQmsVerifierIds(pageId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('pageVerifiers')
      .innerJoin(
        'pageVerifications',
        'pageVerifications.id',
        'pageVerifiers.pageVerificationId',
      )
      .innerJoin('users', 'users.id', 'pageVerifiers.userId')
      .select('pageVerifiers.userId')
      .where('pageVerifications.pageId', '=', pageId)
      .where('pageVerifications.type', '=', 'qms')
      .whereRef('users.workspaceId', '=', 'pageVerifications.workspaceId')
      .where('users.deactivatedAt', 'is', null)
      .where('users.deletedAt', 'is', null)
      .orderBy('pageVerifiers.createdAt', 'asc')
      .execute();

    return rows.map((row) => row.userId);
  }

  private async findActiveSpaceApproverIds(pageId: string): Promise<string[]> {
    const space = await this.db
      .selectFrom('pages')
      .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
      .select(['spaces.settings', 'spaces.workspaceId'])
      .where('pages.id', '=', pageId)
      .executeTakeFirst();
    if (!space) return [];

    const approverIds = readSpaceApprovalSettings(
      space.settings,
    ).approverIds.filter((id) => isValidUUID(id));
    if (approverIds.length === 0) return [];

    const users = await this.db
      .selectFrom('users')
      .select('id')
      .where('id', 'in', approverIds)
      .where('workspaceId', '=', space.workspaceId)
      .where('deactivatedAt', 'is', null)
      .where('deletedAt', 'is', null)
      .execute();

    const activeIds = new Set(users.map((user) => user.id));
    return approverIds.filter((id) => activeIds.has(id));
  }
}
