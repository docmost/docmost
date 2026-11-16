import { IsIn, IsOptional } from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  WORKSPACE_USER_LIST_STATUSES,
  WorkspaceUserListStatus,
} from '../workspace.constants';

export class ListWorkspaceUsersDto extends PaginationOptions {
  @IsOptional()
  @IsIn(WORKSPACE_USER_LIST_STATUSES)
  status?: WorkspaceUserListStatus;
}
