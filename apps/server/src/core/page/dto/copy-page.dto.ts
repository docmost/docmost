import { IsString, IsNotEmpty } from 'class-validator';

export class CopyPageToSpaceDto {
  @IsNotEmpty()
  @IsString()
  pageId: string;

  @IsNotEmpty()
  @IsString()
  spaceId: string;
}

export type CopyPageMapEntry = {
  newPageId: string;
  newSlugId: string;
  oldSlugId: string;
};
