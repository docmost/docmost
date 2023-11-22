import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { PageHistory } from '../entities/page-history.entity';

@Injectable()
export class PageHistoryRepository extends Repository<PageHistory> {
  constructor(private dataSource: DataSource) {
    super(PageHistory, dataSource.createEntityManager());
  }

  async findById(pageId: string) {
    return this.findOne({
      where: {
        id: pageId,
      },
      relations: ['lastUpdatedBy'],
      select: {
        lastUpdatedBy: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    });
  }
}
