import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SpaceMember } from '../entities/space-member.entity';

@Injectable()
export class SpaceMemberRepository extends Repository<SpaceMember> {
  constructor(private dataSource: DataSource) {
    super(SpaceMember, dataSource.createEntityManager());
  }
}
