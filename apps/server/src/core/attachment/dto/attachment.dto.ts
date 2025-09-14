import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { AttachmentType } from '../attachment.constants';

export class RemoveIconDto {
  @IsEnum(AttachmentType)
  @IsNotEmpty()
  type: AttachmentType;

  @IsOptional()
  @IsUUID()
  spaceId: string;
}
