import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';

@Injectable()
export class WorkspaceRepository extends Repository<Workspace> {
  constructor(private dataSource: DataSource) {
    super(Workspace, dataSource.createEntityManager());
  }

  async findById(workspaceId: string) {
    return this.findOneBy({ id: workspaceId });
  }
}
