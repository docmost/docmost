import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Page } from '../entities/page.entity';

@Injectable()
export class PageRepository extends Repository<Page> {
  constructor(private dataSource: DataSource) {
    super(Page, dataSource.createEntityManager());
  }

  public baseFields = [
    'page.id',
    'page.title',
    'page.slug',
    'page.icon',
    'page.coverPhoto',
    'page.shareId',
    'page.parentPageId',
    'page.creatorId',
    'page.lastUpdatedById',
    'page.workspaceId',
    'page.isLocked',
    'page.status',
    'page.publishedAt',
    'page.createdAt',
    'page.updatedAt',
    'page.deletedAt',
  ];

  private async baseFind(pageId: string, selectFields: string[]) {
    return this.dataSource
      .createQueryBuilder(Page, 'page')
      .where('page.id = :id', { id: pageId })
      .select(selectFields)
      .getOne();
  }

  async findById(pageId: string) {
    return this.baseFind(pageId, this.baseFields);
  }

  async findWithYDoc(pageId: string) {
    const extendedFields = [...this.baseFields, 'page.ydoc'];
    return this.baseFind(pageId, extendedFields);
  }

  async findWithContent(pageId: string) {
    const extendedFields = [...this.baseFields, 'page.content'];
    return this.baseFind(pageId, extendedFields);
  }

  async findWithAllFields(pageId: string) {
    const extendedFields = [...this.baseFields, 'page.content', 'page.ydoc'];
    return this.baseFind(pageId, extendedFields);
  }
}
