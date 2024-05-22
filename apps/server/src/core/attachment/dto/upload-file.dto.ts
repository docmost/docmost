import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UploadFileDto {
  @IsString()
  @IsNotEmpty()
  attachmentType: string;

  @IsOptional()
  @IsUUID()
  pageId: string;

  @IsDefined()
  file: any;
}
