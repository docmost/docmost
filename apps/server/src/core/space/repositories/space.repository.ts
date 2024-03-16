import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Space } from '../entities/space.entity';

@Injectable()
export class SpaceRepository extends Repository<Space> {
  constructor(private dataSource: DataSource) {
    super(Space, dataSource.createEntityManager());
  }

  async findById(spaceId: string, workspaceId: string): Promise<Space> {
    const queryBuilder = this.dataSource.createQueryBuilder(Space, 'space');
    return await queryBuilder
      .where('space.id = :id', { id: spaceId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId })
      .getOne();
  }
}
