import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SpaceUser } from '../entities/space-user.entity';

@Injectable()
export class SpaceUserRepository extends Repository<SpaceUser> {
  constructor(private dataSource: DataSource) {
    super(SpaceUser, dataSource.createEntityManager());
  }
}
