import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { AttachmentType } from '../attachment.constants';

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
