import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateShareDto, ShareInfoDto, UpdateShareDto } from './dto/share.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { nanoIdGen } from '../../common/helpers';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { TokenService } from '../auth/services/token.service';
import { jsonToNode } from '../../collaboration/collaboration.util';
import {
  getAttachmentIds,
  getProsemirrorContent,
  isAttachmentNode,
  removeMarkTypeFromDoc,
} from '../../common/helpers/prosemirror/utils';
import { Node } from '@tiptap/pm/model';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { updateAttachmentAttr } from './share.util';
import { Page } from '@docmost/db/types/entity.types';
import { validate as isValidUUID } from 'uuid';
import { sql } from 'kysely';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private readonly shareRepo: ShareRepo,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly tokenService: TokenService,
  ) {}

  async getShareTree(shareId: string, workspaceId: string) {
    const share = await this.shareRepo.findById(shareId);
    if (!share || share.workspaceId !== workspaceId) {
      throw new NotFoundException('Share not found');
    }

    if (share.includeSubPages) {
      const allPages = await this.pageRepo.getPageAndDescendants(share.pageId, {
        includeContent: false,
      });

      // Filter out restricted pages and maintain tree integrity
      const filteredPages = await this.filterPublicPages(allPages, share.pageId);

      return { share, pageTree: filteredPages };
    } else {
      return { share, pageTree: [] };
    }
  }

  /**
   * Filter pages for public share - exclude restricted pages.
   * A page is included only if:
   * 1. It has no page_access restriction AND
   * 2. Its parent is also included (or it's the root)
   */
  private async filterPublicPages<
    T extends { id: string; parentPageId: string | null },
  >(pages: T[], rootPageId: string): Promise<T[]> {
    if (pages.length === 0) return [];

    // Get all restricted page IDs
    const restrictedIds =
      await this.pagePermissionRepo.getRestrictedDescendantIds(rootPageId);
    const restrictedSet = new Set(restrictedIds);

    // Include pages that are NOT restricted and have valid parent chain
    const includedIds = new Set<string>();

    let changed = true;
    while (changed) {
      changed = false;
      for (const page of pages) {
        if (includedIds.has(page.id)) continue;
        if (restrictedSet.has(page.id)) continue;

        // Root page: include if not restricted
        if (page.id === rootPageId) {
          includedIds.add(page.id);
          changed = true;
          continue;
        }

        // Non-root: include if parent is included
        if (page.parentPageId && includedIds.has(page.parentPageId)) {
          includedIds.add(page.id);
          changed = true;
        }
      }
    }

    return pages.filter((p) => includedIds.has(p.id));
  }

  /**
   * Check if a specific page is accessible within a public share.
   * A page is accessible if no page in its ancestor chain
   * (from the page up to and including the share root) has a page_access restriction.
   */
  private async isPagePubliclyAccessible(
    pageId: string,
    shareRootPageId: string,
  ): Promise<boolean> {
    if (pageId === shareRootPageId) {
      const hasRestriction = await this.db
        .selectFrom('pageAccess')
        .select('id')
        .where('pageId', '=', pageId)
        .executeTakeFirst();
      return !hasRestriction;
    }

    // Get the depth from share root to the requested page
    const shareToPage = await this.db
      .selectFrom('pageHierarchy')
      .select('depth')
      .where('ancestorId', '=', shareRootPageId)
      .where('descendantId', '=', pageId)
      .executeTakeFirst();

    if (!shareToPage) {
      return false;
    }

    // Get all ancestor IDs in the chain from pageId to shareRootPageId
    const chainPageIds = await this.db
      .selectFrom('pageHierarchy')
      .select('ancestorId')
      .where('descendantId', '=', pageId)
      .where('depth', '<=', shareToPage.depth)
      .where('depth', '>', 0)
      .execute();

    const idsToCheck = [pageId, ...chainPageIds.map((c) => c.ancestorId)];

    // Check if any page in the chain has a restriction
    const hasRestricted = await this.db
      .selectFrom('pageAccess')
      .select('pageId')
      .where('pageId', 'in', idsToCheck)
      .executeTakeFirst();

    return !hasRestricted;
  }

  async createShare(opts: {
    authUserId: string;
    workspaceId: string;
    page: Page;
    createShareDto: CreateShareDto;
  }) {
    const { authUserId, workspaceId, page, createShareDto } = opts;

    try {
      const shares = await this.shareRepo.findByPageId(page.id);
      if (shares) {
        return shares;
      }

      return await this.shareRepo.insertShare({
        key: nanoIdGen().toLowerCase(),
        pageId: page.id,
        includeSubPages: createShareDto.includeSubPages ?? false,
        searchIndexing: createShareDto.searchIndexing ?? false,
        creatorId: authUserId,
        spaceId: page.spaceId,
        workspaceId,
      });
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to share page');
    }
  }

  async updateShare(shareId: string, updateShareDto: UpdateShareDto) {
    try {
      return this.shareRepo.updateShare(
        {
          includeSubPages: updateShareDto.includeSubPages,
          searchIndexing: updateShareDto.searchIndexing,
        },
        shareId,
      );
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to update share');
    }
  }

  async getSharedPage(dto: ShareInfoDto, workspaceId: string) {
    const share = await this.getShareForPage(dto.pageId, workspaceId);

    if (!share) {
      throw new NotFoundException('Shared page not found');
    }

    // For descendant pages, verify the ancestor chain has no restrictions
    if (share.level > 0) {
      const isAccessible = await this.isPagePubliclyAccessible(
        dto.pageId,
        share.pageId,
      );
      if (!isAccessible) {
        throw new NotFoundException('Shared page not found');
      }
    }

    const page = await this.pageRepo.findById(dto.pageId, {
      includeContent: true,
      includeCreator: true,
    });

    if (!page || page.deletedAt) {
      throw new NotFoundException('Shared page not found');
    }

    page.content = await this.updatePublicAttachments(page);

    return { page, share };
  }

  async getShareForPage(pageId: string, workspaceId: string) {
    // here we try to check if a page was shared directly or if it inherits the share from its closest shared ancestor
    const share = await this.db
      .withRecursive('page_hierarchy', (cte) =>
        cte
          .selectFrom('pages')
          .select([
            'id',
            'slugId',
            'pages.title',
            'pages.icon',
            'parentPageId',
            sql`0`.as('level'),
          ])
          .where(isValidUUID(pageId) ? 'id' : 'slugId', '=', pageId)
          .where('deletedAt', 'is', null)
          .unionAll((union) =>
            union
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.slugId',
                'p.title',
                'p.icon',
                'p.parentPageId',
                // Increase the level by 1 for each ancestor.
                sql`ph.level + 1`.as('level'),
              ])
              .innerJoin('page_hierarchy as ph', 'ph.parentPageId', 'p.id')
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('page_hierarchy')
      .leftJoin('shares', 'shares.pageId', 'page_hierarchy.id')
      .select([
        'page_hierarchy.id as sharedPageId',
        'page_hierarchy.slugId as sharedPageSlugId',
        'page_hierarchy.title as sharedPageTitle',
        'page_hierarchy.icon as sharedPageIcon',
        'page_hierarchy.level as level',
        'shares.id',
        'shares.key',
        'shares.pageId',
        'shares.includeSubPages',
        'shares.searchIndexing',
        'shares.creatorId',
        'shares.spaceId',
        'shares.workspaceId',
        'shares.createdAt',
        'shares.updatedAt',
      ])
      .where('shares.id', 'is not', null)
      .orderBy('page_hierarchy.level', 'asc')
      .executeTakeFirst();

    if (!share || share.workspaceId != workspaceId) {
      return undefined;
    }

    if (share.level === 1 && !share.includeSubPages) {
      // we can only show a page if its shared ancestor permits it
      return undefined;
    }

    return {
      id: share.id,
      key: share.key,
      includeSubPages: share.includeSubPages,
      searchIndexing: share.searchIndexing,
      pageId: share.pageId,
      creatorId: share.creatorId,
      spaceId: share.spaceId,
      workspaceId: share.workspaceId,
      createdAt: share.createdAt,
      level: share.level,
      sharedPage: {
        id: share.sharedPageId,
        slugId: share.sharedPageSlugId,
        title: share.sharedPageTitle,
        icon: share.sharedPageIcon,
      },
    };
  }

  async getShareAncestorPage(
    ancestorPageId: string,
    childPageId: string,
  ): Promise<any> {
    let ancestor = null;
    try {
      ancestor = await this.db
        .withRecursive('page_ancestors', (db) =>
          db
            .selectFrom('pages')
            .select([
              'id',
              'slugId',
              'title',
              'parentPageId',
              'spaceId',
              (eb) =>
                eb
                  .case()
                  .when(eb.ref('id'), '=', ancestorPageId)
                  .then(true)
                  .else(false)
                  .end()
                  .as('found'),
            ])
            .where(isValidUUID(childPageId) ? 'id' : 'slugId', '=', childPageId)
            .unionAll((exp) =>
              exp
                .selectFrom('pages as p')
                .select([
                  'p.id',
                  'p.slugId',
                  'p.title',
                  'p.parentPageId',
                  'p.spaceId',
                  (eb) =>
                    eb
                      .case()
                      .when(eb.ref('p.id'), '=', ancestorPageId)
                      .then(true)
                      .else(false)
                      .end()
                      .as('found'),
                ])
                .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id')
                // Continue recursing only when the target ancestor hasn't been found on that branch.
                .where('pa.found', '=', false),
            ),
        )
        .selectFrom('page_ancestors')
        .selectAll()
        .where('found', '=', true)
        .limit(1)
        .executeTakeFirst();
    } catch (err) {
      // empty
    }

    return ancestor;
  }

  async updatePublicAttachments(page: Page): Promise<any> {
    const prosemirrorJson = getProsemirrorContent(page.content);
    const attachmentIds = getAttachmentIds(prosemirrorJson);
    const attachmentMap = new Map<string, string>();

    await Promise.all(
      attachmentIds.map(async (attachmentId: string) => {
        const token = await this.tokenService.generateAttachmentToken({
          attachmentId,
          pageId: page.id,
          workspaceId: page.workspaceId,
        });
        attachmentMap.set(attachmentId, token);
      }),
    );

    const doc = jsonToNode(prosemirrorJson);

    doc?.descendants((node: Node) => {
      if (!isAttachmentNode(node.type.name)) return;

      const attachmentId = node.attrs.attachmentId;
      const token = attachmentMap.get(attachmentId);
      if (!token) return;

      updateAttachmentAttr(node, 'src', token);
      updateAttachmentAttr(node, 'url', token);
    });

    const removeCommentMarks = removeMarkTypeFromDoc(doc, 'comment');
    return removeCommentMarks.toJSON();
  }
}
