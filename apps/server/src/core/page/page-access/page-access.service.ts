import { ForbiddenException, Injectable } from '@nestjs/common';
import { Page, User } from '@docmost/db/types/entity.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export class PageAccessService {
  constructor(
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  /**
   * Validate user can view page, throws ForbiddenException if not.
   * If page has restrictions: page-level permission determines access.
   * If no restrictions: space-level permission determines access.
   */
  async validateCanView(page: Page, user: User): Promise<void> {
    // TODO: cache by pageId and userId.
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);

    // User must be at least a space member
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const canAccess = await this.pagePermissionRepo.canUserAccessPage(
      user.id,
      page.id,
    );
    if (!canAccess) {
      throw new ForbiddenException();
    }
  }

  /**
   * Validate user can view page AND return effective canEdit permission.
   * Combines access check + edit permission in a single query pass.
   */
  async validateCanViewWithPermissions(
    page: Page,
    user: User,
  ): Promise<{ canEdit: boolean; hasRestriction: boolean }> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);

    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const { hasAnyRestriction, canAccess, canEdit } =
      await this.pagePermissionRepo.canUserEditPage(user.id, page.id);

    if (hasAnyRestriction && !canAccess) {
      throw new ForbiddenException();
    }

    return {
      canEdit: hasAnyRestriction
        ? canEdit
        : ability.can(SpaceCaslAction.Edit, SpaceCaslSubject.Page),
      hasRestriction: hasAnyRestriction,
    };
  }

  /**
   * Validate user can edit page, throws ForbiddenException if not.
   * If page has restrictions: page-level writer permission determines access.
   * If no restrictions: space-level edit permission determines access.
   */
  async validateCanEdit(
    page: Page,
    user: User,
  ): Promise<{ hasRestriction: boolean }> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);

    // User must be at least a space member
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const { hasAnyRestriction, canEdit } =
      await this.pagePermissionRepo.canUserEditPage(user.id, page.id);

    if (hasAnyRestriction) {
      // Page has restrictions - use page-level permission
      if (!canEdit) {
        throw new ForbiddenException();
      }
    } else {
      // No restrictions - use space-level permission
      if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    }

    return { hasRestriction: hasAnyRestriction };
  }

  async validateCanComment(
    page: Page,
    user: User,
    workspaceId: string,
  ): Promise<void> {
    try {
      await this.validateCanEdit(page, user);
      return;
    } catch {
      // User cannot edit — check if reader commenting is enabled
    }

    await this.validateCanView(page, user);

    const space = await this.spaceRepo.findById(page.spaceId, workspaceId);
    const settings = space?.settings as Record<string, any> | null;
    if (
      !settings?.comments?.allowViewerComments ||
      settings?.comments?.hideCommentsFromViewers
    ) {
      throw new ForbiddenException();
    }
  }

  async validateCanViewComments(
    page: Page,
    user: User,
    workspaceId: string,
  ): Promise<void> {
    const { canEdit } = await this.validateCanViewWithPermissions(page, user);
    if (canEdit) {
      return;
    }

    const space = await this.spaceRepo.findById(page.spaceId, workspaceId);
    const settings = space?.settings as Record<string, any> | null;
    if (settings?.comments?.hideCommentsFromViewers) {
      throw new ForbiddenException();
    }
  }

  /**
   * Callers must pass userIds that already have space access (WS room members / pre-filtered notification recipients).
   */
  async filterUserIdsWithPageEditAccess(
    spaceId: string,
    pageId: string,
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }

    const spaceHasRestrictedPages =
      await this.pagePermissionRepo.hasRestrictedPagesInSpace(spaceId);
    const hasRestriction =
      spaceHasRestrictedPages &&
      (await this.pagePermissionRepo.hasRestrictedAncestor(pageId));

    if (!hasRestriction) {
      const editCapableIds =
        await this.spaceMemberRepo.getUserIdsWithSpaceEditAccess(
          userIds,
          spaceId,
        );
      return userIds.filter((id) => editCapableIds.has(id));
    }

    const results = await Promise.all(
      userIds.map(async (userId) => {
        const { canEdit } = await this.pagePermissionRepo.canUserEditPage(
          userId,
          pageId,
        );
        return canEdit ? userId : null;
      }),
    );

    return results.filter((id): id is string => id !== null);
  }
}
