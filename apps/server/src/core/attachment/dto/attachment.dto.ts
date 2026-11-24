import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AttachmentType, type DiagramType } from '../attachment.constants';

export class AttachmentInfoDto {
  @IsNotEmpty()
  @IsUUID()
  attachmentId: string;
}

export class DiagramHistoryDto extends AttachmentInfoDto {
  @IsOptional()
  @IsUUID()
  before?: string;
}

export class DiagramDraftDto {
  @IsUUID()
  draftId: string;

  @IsIn(['drawio', 'excalidraw'])
  type: DiagramType;

  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class RenameDiagramDto extends AttachmentInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

export class DeleteAttachmentDto {
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
