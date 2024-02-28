import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Space } from '../entities/space.entity';

@Injectable()
export class SpaceRepository extends Repository<Space> {
  constructor(private dataSource: DataSource) {
    super(Space, dataSource.createEntityManager());
  }

  async findById(spaceId: string) {
    return this.findOneBy({ id: spaceId });
  }
}
