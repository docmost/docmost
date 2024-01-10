import { BadRequestException, Injectable } from '@nestjs/common';
import { PageHistory } from '../entities/page-history.entity';
import { Page } from '../entities/page.entity';
import { PageHistoryRepository } from '../repositories/page-history.repository';

@Injectable()
export class PageHistoryService {
  constructor(private pageHistoryRepo: PageHistoryRepository) {
  }

  async findOne(historyId: string): Promise<PageHistory> {
    const history = await this.pageHistoryRepo.findById(historyId);
    if (!history) {
      throw new BadRequestException('History not found');
    }
    return history;
  }

  async saveHistory(page: Page): Promise<void> {
    const pageHistory = new PageHistory();
    pageHistory.pageId = page.id;
    pageHistory.title = page.title;
    pageHistory.content = page.content;
    pageHistory.slug = page.slug;
    pageHistory.icon = page.icon;
    pageHistory.version = 1; // TODO: make incremental
    pageHistory.coverPhoto = page.coverPhoto;
    pageHistory.lastUpdatedById = page.lastUpdatedById ?? page.creatorId;
    pageHistory.workspaceId = page.workspaceId;

    await this.pageHistoryRepo.save(pageHistory);
  }

  async findHistoryByPageId(pageId: string, limit = 50, offset = 0) {
    const history = await this.pageHistoryRepo
      .createQueryBuilder('history')
      .where('history.pageId = :pageId', { pageId })
      .leftJoinAndSelect('history.lastUpdatedBy', 'user')
      .select([
        'history.id',
        'history.pageId',
        'history.title',
        'history.slug',
        'history.icon',
        'history.coverPhoto',
        'history.version',
        'history.lastUpdatedById',
        'history.workspaceId',
        'history.createdAt',
        'history.updatedAt',
        'user.id',
        'user.name',
        'user.avatarUrl',
      ])
      .orderBy('history.updatedAt', 'DESC')
      .offset(offset)
      .take(limit)
      .getMany();
    return history;
  }
}
