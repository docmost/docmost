import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';

@Injectable()
export class WorkspaceRepository extends Repository<Workspace> {
  constructor(private dataSource: DataSource) {
    super(Workspace, dataSource.createEntityManager());
  }

  async findById(workspaceId: string): Promise<Workspace> {
    // see: https://github.com/typeorm/typeorm/issues/9316
    const queryBuilder = this.dataSource.createQueryBuilder(
      Workspace,
      'workspace',
    );
    return await queryBuilder
      .where('workspace.id = :id', { id: workspaceId })
      .getOne();
  }

  async findFirst(): Promise<Workspace> {
    const createdWorkspace = await this.find({
      order: {
        createdAt: 'ASC',
      },
      take: 1,
    });
    return createdWorkspace[0];
  }
}
