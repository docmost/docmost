import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SpaceGroup } from '../entities/space-group.entity';

@Injectable()
export class SpaceGroupRepository extends Repository<SpaceGroup> {
  constructor(private dataSource: DataSource) {
    super(SpaceGroup, dataSource.createEntityManager());
  }
}
