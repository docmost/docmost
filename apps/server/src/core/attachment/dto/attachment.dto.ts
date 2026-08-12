import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { AttachmentType } from '../attachment.constants';

export class AttachmentInfoDto {
  @IsNotEmpty()
  @IsUUID()
  attachmentId: string;
}

export class PageIdDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class RemoveIconDto {
  @IsEnum(AttachmentType)
  @IsIn([
    AttachmentType.Avatar,
    AttachmentType.SpaceIcon,
    AttachmentType.WorkspaceIcon,
  ])
  @IsNotEmpty()
  type: AttachmentType;

  @IsOptional()
  @IsUUID()
  spaceId: string;
}
