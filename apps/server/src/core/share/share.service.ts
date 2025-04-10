import {
  BadRequestException,
  Injectable,
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

@Injectable()
export class ShareService {
  constructor(
    private readonly shareRepo: ShareRepo,
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
    private readonly tokenService: TokenService,
  ) {}

  async createShare(opts: {
    authUserId: string;
    workspaceId: string;
    pageId: string;
    spaceId: string;
  }) {
    const { authUserId, workspaceId, pageId, spaceId } = opts;
    let share = null;
    try {
      const slugId = generateSlugId();
      share = await this.shareRepo.insertShare({
        slugId,
        pageId,
        workspaceId,
        creatorId: authUserId,
        spaceId: spaceId,
      });
    } catch (err) {
      throw new BadRequestException('Failed to share page');
    }

    return share;
  }

  async getShare(dto: ShareInfoDto, workspaceId: string) {
    const share = await this.shareRepo.findById(dto.shareId);

    if (!share || share.workspaceId !== workspaceId) {
      throw new NotFoundException('Share not found');
    }

    let targetPageId = share.pageId;
    if (dto.pageId && dto.pageId !== share.pageId) {
      // Check if dto.pageId is a descendant of the shared page.
      const isDescendant = await this.getShareAncestorPage(
        share.pageId,
        dto.pageId,
      );
      if (isDescendant) {
        targetPageId = dto.pageId;
      } else {
        throw new NotFoundException(`Shared page not found`);
      }
    }

    const page = await this.pageRepo.findById(targetPageId, {
      includeContent: true,
      includeCreator: true,
    });

    page.content = await this.updatePublicAttachments(page);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
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
