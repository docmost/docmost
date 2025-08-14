import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PageIdDto } from './page.dto';
import { PageMemberRole } from '@docmost/db/repos/page/page-permission-repo.service';

export class AddPageMembersDto extends PageIdDto {
  @IsEnum(PageMemberRole)
  role: string;
  // optional
  @IsArray()
  @ArrayMaxSize(25, {
    message: 'userIds must be an array with no more than 25 elements',
  })
  @IsUUID('all', { each: true })
  userIds: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25, {
    message: 'groupIds must be an array with no more than 25 elements',
  })
  @IsUUID('all', { each: true })
  groupIds: string[];

  @IsBoolean()
  @IsOptional()
  cascade?: boolean; // Apply to all child pages
}
