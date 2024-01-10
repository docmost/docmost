import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WorkspaceUser } from '../entities/workspace-user.entity';

@Injectable()
export class WorkspaceUserRepository extends Repository<WorkspaceUser> {
  constructor(private dataSource: DataSource) {
    super(WorkspaceUser, dataSource.createEntityManager());
  }
}
