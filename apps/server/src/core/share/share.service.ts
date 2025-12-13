import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateShareDto,
  CreateSpaceShareDto,
  ShareInfoDto,
  SpaceShareInfoDto,
  UpdateShareDto,
  UpdateSpaceShareDto,
} from './dto/share.dto';
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
    @InjectKysely() private readonly db: KyselyDB,
    private readonly tokenService: TokenService,
  ) {}

  async getShareTree(shareId: string, workspaceId: string) {
    const share = await this.shareRepo.findById(shareId);
    if (!share || share.workspaceId !== workspaceId) {
      throw new NotFoundException('Share not found');
    }

    // Space share: pageId is null, get all pages in the space
    if (!share.pageId) {
      const pageList = await this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'parentPageId', 'position'])
        .where('spaceId', '=', share.spaceId)
        .where('deletedAt', 'is', null)
        .orderBy('position', 'asc')
        .execute();

      return { share, pageTree: pageList };
    }

    // Page share with sub-pages
    if (share.includeSubPages) {
      const pageList = await this.pageRepo.getPageAndDescendants(share.pageId, {
        includeContent: false,
      });

      return { share, pageTree: pageList };
    } else {
      return { share, pageTree: [] };
    }
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

  // Space Share Methods
  async createSpaceShare(opts: {
    authUserId: string;
    workspaceId: string;
    spaceId: string;
    createSpaceShareDto: CreateSpaceShareDto;
  }) {
    const { authUserId, workspaceId, spaceId, createSpaceShareDto } = opts;

    try {
      // Check if space share already exists
      const existingShare = await this.shareRepo.findSpaceShare(spaceId);
      if (existingShare) {
        return existingShare;
      }

      return await this.shareRepo.insertShare({
        key: nanoIdGen().toLowerCase(),
        pageId: null, // null indicates this is a space share
        includeSubPages: true, // Always true for space shares
        searchIndexing: createSpaceShareDto.searchIndexing ?? false,
        creatorId: authUserId,
        spaceId: spaceId,
        workspaceId,
      });
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to share space');
    }
  }

  async updateSpaceShare(shareId: string, updateSpaceShareDto: UpdateSpaceShareDto) {
    try {
      return this.shareRepo.updateShare(
        {
          searchIndexing: updateSpaceShareDto.searchIndexing,
        },
        shareId,
      );
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to update space share');
    }
  }

  async getSpaceShare(spaceId: string) {
    return this.shareRepo.findSpaceShare(spaceId);
  }

  async getSpaceShareTree(shareId: string, workspaceId: string) {
    const share = await this.shareRepo.findById(shareId);
    if (!share || share.workspaceId !== workspaceId) {
      throw new NotFoundException('Share not found');
    }

    // For space shares (pageId is null), get all root pages in the space
    if (!share.pageId) {
      const pageList = await this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'parentPageId', 'position'])
        .where('spaceId', '=', share.spaceId)
        .where('deletedAt', 'is', null)
        .orderBy('position', 'asc')
        .execute();

      return { share, pageTree: pageList };
    }

    // For page shares, use existing logic
    if (share.includeSubPages) {
      const pageList = await this.pageRepo.getPageAndDescendants(share.pageId, {
        includeContent: false,
      });
      return { share, pageTree: pageList };
    } else {
      return { share, pageTree: [] };
    }
  }

  async getSharedSpacePage(dto: SpaceShareInfoDto, workspaceId: string) {
    const share = await this.shareRepo.findById(dto.shareId);

    if (!share || share.workspaceId !== workspaceId) {
      throw new NotFoundException('Share not found');
    }

    // Verify this is a space share
    if (share.pageId !== null) {
      throw new BadRequestException('This is not a space share');
    }

    // If pageId is provided, get that specific page
    if (dto.pageId) {
      const page = await this.pageRepo.findById(dto.pageId, {
        includeContent: true,
        includeCreator: true,
      });

      if (!page || page.deletedAt || page.spaceId !== share.spaceId) {
        throw new NotFoundException('Page not found in shared space');
      }

      page.content = await this.updatePublicAttachments(page);
      return { page, share };
    }

    // If no pageId, get the first root page
    const firstPage = await this.db
      .selectFrom('pages')
      .select(['id'])
      .where('spaceId', '=', share.spaceId)
      .where('parentPageId', 'is', null)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .limit(1)
      .executeTakeFirst();

    if (!firstPage) {
      throw new NotFoundException('No pages in shared space');
    }

    const page = await this.pageRepo.findById(firstPage.id, {
      includeContent: true,
      includeCreator: true,
    });

    page.content = await this.updatePublicAttachments(page);
    return { page, share };
  }

  async getSharedPage(dto: ShareInfoDto, workspaceId: string) {
    const share = await this.getShareForPage(dto.pageId, workspaceId);

    if (!share) {
      throw new NotFoundException('Shared page not found');
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

    if (share && share.workspaceId === workspaceId) {
      if (share.level === 1 && !share.includeSubPages) {
        // we can only show a page if its shared ancestor permits it
        // fall through to check for space share
      } else {
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
    }

    // Check if the page's space is shared (space share)
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      return undefined;
    }

    const spaceShare = await this.shareRepo.findSpaceShare(page.spaceId);
    if (spaceShare && spaceShare.workspaceId === workspaceId) {
      // Get space info for the shared space
      const space = await this.db
        .selectFrom('spaces')
        .select(['id', 'name', 'slug'])
        .where('id', '=', page.spaceId)
        .executeTakeFirst();

      return {
        id: spaceShare.id,
        key: spaceShare.key,
        includeSubPages: true,
        searchIndexing: spaceShare.searchIndexing,
        pageId: null, // null indicates space share
        creatorId: spaceShare.creatorId,
        spaceId: spaceShare.spaceId,
        workspaceId: spaceShare.workspaceId,
        createdAt: spaceShare.createdAt,
        level: -1, // -1 indicates space share level
        isSpaceShare: true,
        sharedSpace: space,
      };
    }

    return undefined;
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
