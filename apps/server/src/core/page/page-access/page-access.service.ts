import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MongoAbility } from '@casl/ability';
import { Page, User } from '@docmost/db/types/entity.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  ISpaceAbility,
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { CacheOptions } from '../../../common/helpers/with-cache';
import { PageApprovalService } from '../approval/page-approval.service';
import { ApprovalState } from '../approval/page-approval.types';

@Injectable()
export class PageAccessService {
  constructor(
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly spaceRepo: SpaceRepo,
    private readonly pageApprovalService: PageApprovalService,
  ) {}

  /**
   * Validate user can view page, throws ForbiddenException if not.
   * If page has restrictions: page-level permission determines access.
   * If no restrictions: space-level permission determines access.
   * A page hidden by an unpublished approval page throws NotFoundException.
   */
  async validateCanView(
    page: Page,
    user: User,
    opts?: CacheOptions,
  ): Promise<void> {
    // TODO: cache by pageId and userId.
    const ability = await this.spaceAbility.createForUser(
      user,
      page.spaceId,
      opts,
    );

    // User must be at least a space member
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const permission = await this.pagePermissionRepo.canUserEditPage(
      user.id,
      page.id,
      opts,
    );
    if (!permission.canAccess) {
      throw new ForbiddenException();
    }

    if (!this.canEditWith(ability, permission)) {
      await this.assertNotHidden(page, user);
    }
  }

  /**
   * Validate user can view page AND return effective canEdit permission.
   * Combines access check + edit permission in a single query pass.
   */
  async validateCanViewWithPermissions(
    page: Page,
    user: User,
  ): Promise<{
    canEdit: boolean;
    hasRestriction: boolean;
    approval: {
      controlled: boolean;
      canAccessDraft: boolean;
      locked: boolean;
      unpublished: boolean;
    };
  }> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);

    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const permission = await this.pagePermissionRepo.canUserEditPage(
      user.id,
      page.id,
    );

    if (permission.hasAnyRestriction && !permission.canAccess) {
      throw new ForbiddenException();
    }

    const canEdit = this.canEditWith(ability, permission);
    const state = await this.pageApprovalService.getState(page);
    const canAccessDraft =
      canEdit ||
      (await this.pageApprovalService.canAccessDraft(user, page, state));

    if (!canAccessDraft) {
      await this.assertNotHidden(page, user, state);
    }

    return {
      canEdit,
      hasRestriction: permission.hasAnyRestriction,
      approval: {
        controlled: state.controlled,
        canAccessDraft,
        locked: canAccessDraft && state.locked,
        unpublished: state.unpublished,
      },
    };
  }

  /**
   * Validate user can edit page, throws ForbiddenException if not.
   * If page has restrictions: page-level writer permission determines access.
   * If no restrictions: space-level edit permission determines access.
   * A page hidden by an unpublished approval page throws NotFoundException.
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

    const permission = await this.pagePermissionRepo.canUserEditPage(
      user.id,
      page.id,
    );

    if (permission.hasAnyRestriction && !permission.canAccess) {
      throw new ForbiddenException();
    }

    if (!this.canEditWith(ability, permission)) {
      await this.assertNotHidden(page, user);
      throw new ForbiddenException();
    }

    return { hasRestriction: permission.hasAnyRestriction };
  }

  /**
   * Validate user can create a root page in the space, throws if not.
   * For non-HTTP callers (Slack, integrations) that skip the controller check.
   */
  async validateCanCreate(spaceId: string, user: User): Promise<void> {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
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
    if (!settings?.comments?.allowViewerComments) {
      throw new ForbiddenException();
    }
  }

  // Restricted pages use the page-level role, others the space role.
  private canEditWith(
    ability: MongoAbility<ISpaceAbility>,
    permission: { hasAnyRestriction: boolean; canEdit: boolean },
  ): boolean {
    return permission.hasAnyRestriction
      ? permission.canEdit
      : ability.can(SpaceCaslAction.Edit, SpaceCaslSubject.Page);
  }

  // Callers skip users who can edit (they always have draft access) and run it after the restriction check.
  private async assertNotHidden(
    page: Page,
    user: User,
    state?: ApprovalState,
  ): Promise<void> {
    if (await this.pageApprovalService.isHiddenFromUser(user.id, page, state)) {
      throw new NotFoundException('Page not found');
    }
  }
}
