import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Page } from '../entities/page.entity';

@Injectable()
export class PageRepository extends Repository<Page> {
  constructor(private dataSource: DataSource) {
    super(Page, dataSource.createEntityManager());
  }

  async findById(pageId: string) {
    return this.findOneBy({ id: pageId });
  }

  async findWithoutYDoc(pageId: string) {
    return this.dataSource
      .createQueryBuilder(Page, 'page')
      .where('page.id = :id', { id: pageId })
      .select([
        'page.id',
        'page.title',
        'page.slug',
        'page.icon',
        'page.coverPhoto',
        'page.editor',
        'page.shareId',
        'page.parentPageId',
        'page.creatorId',
        'page.workspaceId',
        'page.isLocked',
        'page.status',
        'page.publishedAt',
        'page.createdAt',
        'page.updatedAt',
        'page.deletedAt',
      ])
      .getOne();
  }
}
