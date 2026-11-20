import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum ExportFormat {
  HTML = 'html',
  Markdown = 'markdown',
}

export class ExportPageDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsString()
  @IsIn(['html', 'markdown'])
  format: ExportFormat;

  @IsOptional()
  @IsBoolean()
  includeChildren?: boolean;

  @IsOptional()
  @IsBoolean()
  includeAttachments?: boolean;
}

export class ExportSpaceDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  spaceId: string;

  @IsString()
  @IsIn(['html', 'markdown'])
  format: ExportFormat;

  @IsOptional()
  @IsBoolean()
  includeAttachments?: boolean;
}