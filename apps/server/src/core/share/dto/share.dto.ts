import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ShareIdDto {
  @IsString()
  @IsNotEmpty()
  shareId: string;
}

export class SpaceIdDto {
  @IsUUID()
  spaceId: string;
}

export class ShareInfoDto extends ShareIdDto {
  @IsString()
  @IsOptional()
  pageId: string;

  // @IsOptional()
  // @IsBoolean()
  // includeContent: boolean;
}
