import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PublicSpaceRepo } from '@docmost/db/repos/public-space/public-space.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { ShareService } from '../share/share.service';
import { TransclusionService } from '../page/transclusion/transclusion.service';
import { TransclusionLookup } from '../page/transclusion/transclusion.types';
import {
  Page,
  PublicSpace,
  Space,
  Workspace,
} from '@docmost/db/types/entity.types';
import { PublicSpaceAppearanceDto } from './dto/public-space.dto';
import { LicenseCheckService } from '../../integrations/environment/license-check.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { Feature, FeatureKey } from '../../common/features';

@Injectable()
export class PublicSpaceService {
  constructor(
    private readonly publicSpaceRepo: PublicSpaceRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly shareService: ShareService,
    private readonly transclusionService: TransclusionService,
    private readonly licenseCheckService: LicenseCheckService,
    private readonly environmentService: EnvironmentService,
  ) {}

  hasFeature(workspace: Workspace, feature: FeatureKey): boolean {
    return this.licenseCheckService
      .resolveFeatures(workspace.licenseKey, workspace.plan)
      .includes(feature);
  }

  isPublicSpacesAllowed(workspace: Workspace): boolean {
    const settings = workspace.settings as any;
    return (
      this.environmentService.isBetaPublicSpaces() &&
      settings?.publicSpaces?.enabled === true
    );
  }

  private isDirectoryEnabled(workspace: Workspace): boolean {
    return (workspace.settings as any)?.publicSpaces?.directory === true;
  }

  async getPublicSpace(spaceSlug: string, workspace: Workspace) {
    if (!this.isPublicSpacesAllowed(workspace)) {
      throw new NotFoundException('Space not found');
    }

    const space = await this.spaceRepo.findBySlug(spaceSlug, workspace.id);
    if (!space || space.deletedAt) {
      throw new NotFoundException('Space not found');
    }

    const publicSpace = await this.publicSpaceRepo.findBySpaceId(space.id);
    if (!publicSpace?.enabled) {
      throw new NotFoundException('Space not found');
    }

    return { space, publicSpace };
  }

  async getPublicSpaceInfo(spaceSlug: string, workspace: Workspace) {
    const { space, publicSpace } = await this.getPublicSpace(
      spaceSlug,
      workspace,
    );
    return {
      space: this.toPublicSpaceFields(space),
      searchIndexing: publicSpace.searchIndexing,
      appearance: this.toPublicAppearance(publicSpace, workspace),
    };
  }

  async getPublicSpaceTree(spaceSlug: string, workspace: Workspace) {
    const { space, publicSpace } = await this.getPublicSpace(
      spaceSlug,
      workspace,
    );
    const pageTree = await this.pageRepo.getSpacePagesExcludingRestricted(
      space.id,
    );
    return {
      space: this.toPublicSpaceFields(space),
      pageTree,
      appearance: this.toPublicAppearance(publicSpace, workspace),
    };
  }

  async getPublicPage(
    spaceSlug: string,
    pageSlugId: string | undefined,
    workspace: Workspace,
    opts?: { includeContent?: boolean },
  ) {
    const includeContent = opts?.includeContent !== false;

    const { space, publicSpace } = await this.getPublicSpace(
      spaceSlug,
      workspace,
    );
    const byline = this.getBylineSettings(publicSpace);

    let pageId = pageSlugId;
    if (!pageId) {
      const firstRoot = await this.pageRepo.getFirstUnrestrictedRootPage(
        space.id,
      );
      if (!firstRoot) {
        return {
          page: null,
          space: this.toPublicSpaceFields(space),
          searchIndexing: publicSpace.searchIndexing,
          appearance: this.toPublicAppearance(publicSpace, workspace),
          byline,
        };
      }
      pageId = firstRoot.id;
    }

    const page = includeContent
      ? await this.pageRepo.findById(pageId, {
          includeContent: true,
          includeCreator: byline.author,
        })
      : await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    // cross-space targets resolve only as contentless link probes, and only
    // into published spaces; content stays canonical under its own space URL
    if (page.spaceId !== space.id) {
      if (includeContent) {
        throw new NotFoundException('Page not found');
      }
      return this.resolveCrossSpacePublicPage(page, workspace);
    }

    const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(
      page.id,
    );
    if (isRestricted) {
      throw new NotFoundException('Page not found');
    }

    // never ship creator details the space admin chose to hide
    if (!byline.author && 'creator' in page) {
      delete (page as any).creator;
    }

    if (includeContent) {
      page.content = await this.shareService.updatePublicAttachments(page);
    }

    return {
      page,
      space: this.toPublicSpaceFields(space),
      searchIndexing: publicSpace.searchIndexing,
      appearance: this.toPublicAppearance(publicSpace, workspace),
      byline,
    };
  }

  /** Uniform 404 unless the target page's own space is published, not deleted, in this workspace, and unrestricted. */
  private async resolveCrossSpacePublicPage(page: Page, workspace: Workspace) {
    const space = await this.spaceRepo.findById(page.spaceId, workspace.id);
    if (!space || space.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    const publicSpace = await this.publicSpaceRepo.findBySpaceId(space.id);
    if (!publicSpace?.enabled) {
      throw new NotFoundException('Page not found');
    }

    const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(
      page.id,
    );
    if (isRestricted) {
      throw new NotFoundException('Page not found');
    }

    return {
      page,
      space: this.toPublicSpaceFields(space),
      searchIndexing: publicSpace.searchIndexing,
      appearance: this.toPublicAppearance(publicSpace, workspace),
      byline: this.getBylineSettings(publicSpace),
    };
  }

  /** Share-style transclusion resolution scoped to one public space; viewer permissions are never consulted. */
  async lookupTransclusionForPublicSpace(
    spaceSlug: string,
    references: Array<{ sourcePageId: string; transclusionId: string }>,
    workspace: Workspace,
  ): Promise<{ items: TransclusionLookup[] }> {
    const { space } = await this.getPublicSpace(spaceSlug, workspace);

    const candidatePageIds = Array.from(
      new Set(references.map((r) => r.sourcePageId)),
    );

    const accessibleResults = await Promise.all(
      candidatePageIds.map(async (pageId) => {
        const page = await this.pageRepo.findById(pageId);
        if (!page || page.deletedAt || page.spaceId !== space.id) return null;
        const restricted =
          await this.pagePermissionRepo.hasRestrictedAncestor(page.id);
        if (restricted) return null;
        return page.id;
      }),
    );
    const accessibleSet = new Set<string>(
      accessibleResults.filter((id): id is string => id !== null),
    );

    const { items } = await this.transclusionService.lookupWithAccessSet(
      references,
      accessibleSet,
      workspace.id,
    );

    return {
      items: await this.shareService.sanitizeTransclusionItemsForPublic(
        items,
        workspace.id,
      ),
    };
  }

  async publish(opts: {
    space: Space;
    workspace: Workspace;
    authUserId: string;
    enabled: boolean;
    searchIndexing?: boolean;
    appearance?: PublicSpaceAppearanceDto;
    bylineAuthor?: boolean;
    bylineUpdatedAt?: boolean;
    directory?: boolean;
  }) {
    const {
      space,
      workspace,
      authUserId,
      enabled,
      appearance,
      bylineAuthor,
      bylineUpdatedAt,
    } = opts;
    let { searchIndexing, directory } = opts;

    if (!this.environmentService.isBetaPublicSpaces()) {
      throw new ForbiddenException(
        'Public spaces are not enabled on this instance',
      );
    }

    if (enabled && !this.isPublicSpacesAllowed(workspace)) {
      throw new ForbiddenException(
        'Public spaces are not enabled for this workspace',
      );
    }

    if (appearance && !this.hasFeature(workspace, Feature.PUBLIC_SPACE_APPEARANCE)) {
      throw new ForbiddenException(
        'Public docs appearance requires a paid license',
      );
    }

    const prev = await this.publicSpaceRepo.findBySpaceId(space.id);

    // first publish defaults every option on except the author byline; republish keeps prior customization
    if (enabled && !prev) {
      searchIndexing ??= true;
      if (this.isDirectoryEnabled(workspace)) {
        directory ??= true;
      }
    }

    const hasByline =
      typeof bylineAuthor !== 'undefined' ||
      typeof bylineUpdatedAt !== 'undefined';

    let settings: Record<string, unknown> | undefined;
    if (appearance || hasByline || typeof directory !== 'undefined') {
      const prevSettings = (prev?.settings as Record<string, any>) ?? {};
      settings = { ...prevSettings };

      if (typeof directory !== 'undefined') {
        settings.directory = directory;
      }

      if (appearance) {
        const nextAppearance: Record<string, string> = {
          ...(prevSettings.appearance ?? {}),
        };
        for (const key of ['primaryColorLight', 'primaryColorDark'] as const) {
          const value = appearance[key];
          if (value === null) delete nextAppearance[key];
          else if (typeof value !== 'undefined') nextAppearance[key] = value;
        }
        settings.appearance = nextAppearance;
      }

      if (hasByline) {
        const prevByline = this.getBylineSettings(prev);
        settings.byline = {
          author: bylineAuthor ?? prevByline.author,
          updatedAt: bylineUpdatedAt ?? prevByline.updatedAt,
        };
      }
    }

    return this.publicSpaceRepo.upsert({
      spaceId: space.id,
      workspaceId: space.workspaceId,
      enabled,
      searchIndexing,
      creatorId: authUserId,
      settings,
    });
  }

  /** The /docs hub: listed public spaces only, behind the workspace double opt-in. */
  async getPublicSpaceDirectory(workspace: Workspace) {
    if (
      !this.isPublicSpacesAllowed(workspace) ||
      !this.isDirectoryEnabled(workspace)
    ) {
      throw new NotFoundException('Not found');
    }

    const rows = await this.publicSpaceRepo.findEnabledWithSpaceByWorkspaceId(
      workspace.id,
    );
    const listed = rows.filter(
      (row) => (row.settings as any)?.directory === true,
    );

    return {
      spaces: listed.map((row) => ({
        name: row.name,
        slug: row.slug,
        description: row.description,
        logo: row.logo,
      })),
    };
  }

  private toPublicSpaceFields(space: Space) {
    return {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      logo: space.logo,
    };
  }

  private getBylineSettings(publicSpace: PublicSpace) {
    const byline = (publicSpace?.settings as any)?.byline;
    return {
      author: byline?.author === true,
      updatedAt: byline?.updatedAt !== false,
    };
  }

  private toPublicAppearance(publicSpace: PublicSpace, workspace: Workspace) {
    if (!this.hasFeature(workspace, Feature.PUBLIC_SPACE_APPEARANCE)) {
      return undefined;
    }
    const appearance = (publicSpace?.settings as any)?.appearance;
    if (!appearance) return undefined;
    const result: { primaryColorLight?: string; primaryColorDark?: string } =
      {};
    if (typeof appearance.primaryColorLight === 'string') {
      result.primaryColorLight = appearance.primaryColorLight;
    }
    if (typeof appearance.primaryColorDark === 'string') {
      result.primaryColorDark = appearance.primaryColorDark;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
}
