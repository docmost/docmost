import { Injectable, NotFoundException } from '@nestjs/common';
import { ShareInfoDto } from './dto/share.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { generateSlugId } from '../../common/helpers';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

@Injectable()
export class ShareService {
  constructor(
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async createShare(opts: {
    authUserId: string;
    workspaceId: string;
    pageId: string;
  }) {
    const { authUserId, workspaceId, pageId } = opts;

    const slugId = generateSlugId(); // or custom slug
    const share = this.db
      .insertInto('shares')
      .values({ slugId: slugId, pageId, creatorId: authUserId, workspaceId })
      .returningAll()
      .executeTakeFirst();

    return share;
  }

  async getShare(dto: ShareInfoDto) {
    // for now only single page share

    // if only share Id is provided, return

    // if share id is pass with page id, what to do?
    // if uuid is used, use Id
    const share = await this.db
      .selectFrom('shares')
      .selectAll()
      .where('slugId', '=', dto.shareId)
      .executeTakeFirst();

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    const page = await this.pageRepo.findById(share.pageId, {
      includeContent: true,
      includeCreator: true,
    });

    // cleanup json content
    // remove comments mark
    // make sure attachments work (videos, images, excalidraw, drawio)
    // figure out internal links?

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }
}
