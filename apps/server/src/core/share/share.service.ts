import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ShareInfoDto } from './dto/share.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { generateSlugId } from '../../common/helpers';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { TokenService } from '../auth/services/token.service';
import { jsonToNode } from '../../collaboration/collaboration.util';
import {
  getAttachmentIds,
  getProsemirrorContent,
  isAttachmentNode,
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

  async createShare(opts: {
    authUserId: string;
    workspaceId: string;
    page: Page;
    includeSubPages: boolean;
  }) {
    const { authUserId, workspaceId, page, includeSubPages } = opts;

    try {
      const shares = await this.shareRepo.findByPageId(page.id);
      if (shares) {
        return shares;
      }

      return await this.shareRepo.insertShare({
        key: generateSlugId(),
        pageId: page.id,
        includeSubPages: includeSubPages,
        creatorId: authUserId,
        spaceId: page.spaceId,
        workspaceId,
      });
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Failed to create page');
    }
  }

  async getSharedPage(dto: ShareInfoDto, workspaceId: string) {
    const share = await this.getShareStatus(dto.pageId, workspaceId);

    if (!share) {
      throw new NotFoundException('Shared page not found');
    }

    const page = await this.pageRepo.findById(dto.pageId, {
      includeContent: true,
      includeCreator: true,
    });

    page.content = await this.updatePublicAttachments(page);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async getShareStatus(pageId: string, workspaceId: string) {
    // here we try to check if a page was shared directly or if it inherits the share from its closest shared ancestor
    const share = await this.db
      .withRecursive('page_hierarchy', (cte) =>
        cte
          .selectFrom('pages')
          .select(['id', 'parentPageId', sql`0`.as('level')])
          .where(isValidUUID(pageId) ? 'id' : 'slugId', '=', pageId)
          .unionAll((union) =>
            union
              .selectFrom('pages as p')
              .select([
                'p.id',
                'p.parentPageId',
                // Increase the level by 1 for each ancestor.
                sql`ph.level + 1`.as('level'),
              ])
              .innerJoin('page_hierarchy as ph', 'ph.parentPageId', 'p.id'),
          ),
      )
      .selectFrom('page_hierarchy')
      .leftJoin('shares', 'shares.pageId', 'page_hierarchy.id')
      .select([
        'page_hierarchy.id as sharedPageId',
        'page_hierarchy.level as level',
        'shares.id as shareId',
        'shares.key as shareKey',
        'shares.includeSubPages as includeSubPages',
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
      throw new NotFoundException('Shared page not found');
    }

    if (share.level === 1 && !share.includeSubPages) {
      // we can only show a page if its shared ancestor permits it
      throw new NotFoundException('Shared page not found');
    }

    return share;
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
            .where(
              !isValidUUID(childPageId) ? 'slugId' : 'id',
              '=',
              childPageId,
            )
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

    return doc.toJSON();
  }
}
