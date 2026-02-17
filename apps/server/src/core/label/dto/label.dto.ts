import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddLabelsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  names: string[];
}

export class RemoveLabelDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsUUID()
  labelId: string;
}

export class PageLabelsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class SearchPagesByLabelDto {
  @IsUUID()
  labelId: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
