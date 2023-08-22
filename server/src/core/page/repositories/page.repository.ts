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
}
