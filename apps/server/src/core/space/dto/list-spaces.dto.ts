import { IsIn, IsOptional } from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SPACE_LIST_STATUSES, SpaceListStatus } from '../space.constants';

export class ListSpacesDto extends PaginationOptions {
  @IsOptional()
  @IsIn(SPACE_LIST_STATUSES)
  status?: SpaceListStatus;
}
