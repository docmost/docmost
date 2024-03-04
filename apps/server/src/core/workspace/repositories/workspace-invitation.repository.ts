import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';

@Injectable()
export class WorkspaceInvitationRepository extends Repository<WorkspaceInvitation> {
  constructor(private dataSource: DataSource) {
    super(WorkspaceInvitation, dataSource.createEntityManager());
  }
}
