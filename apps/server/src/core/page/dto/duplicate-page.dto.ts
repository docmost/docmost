import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class DuplicatePageDto {
  @IsNotEmpty()
  @IsString()
  pageId: string;

  @IsOptional()
  @IsString()
  spaceId?: string;
}

export type CopyPageMapEntry = {
  newPageId: string;
  newSlugId: string;
  oldSlugId: string;
};

export type ICopyPageAttachment = {
  newPageId: string,
  oldPageId: string,
  oldAttachmentId: string,
  newAttachmentId: string,
};
