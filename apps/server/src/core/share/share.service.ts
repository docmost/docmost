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
  isAttachmentNode,
} from '../../common/helpers/prosemirror/utils';
import { Node } from '@tiptap/pm/model';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { updateAttachmentAttr } from './share.util';
import { Page } from '@docmost/db/types/entity.types';

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

    const page = await this.pageRepo.findById(share.pageId, {
      includeContent: true,
      includeCreator: true,
    });

    page.content = await this.updatePublicAttachments(page);

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async updatePublicAttachments(page: Page): Promise<any> {
    const attachmentIds = getAttachmentIds(page.content);
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

    const doc = jsonToNode(page.content as any);

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
