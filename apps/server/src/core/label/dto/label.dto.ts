import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { LabelType } from '@docmost/db/repos/label/label.repo';
import { PageIdDto } from '../../page/dto/page.dto';
import { normalizeLabelName } from '../utils';

//TODO: We may support SPACE/TEMPLATE labels in the future
const SUPPORTED_LABEL_TYPES: LabelType[] = [LabelType.PAGE];

export class AddLabelsDto extends PageIdDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(normalizeLabelName) : value,
  )
  @MaxLength(100, { each: true })
  @Matches(/^[a-z0-9_-][a-z0-9_~-]*$/, {
    each: true,
    message:
      'Label names can only contain letters, numbers, hyphens, underscores, and tildes, and cannot start with a tilde',
  })
  names: string[];
}

export class RemoveLabelDto extends PageIdDto {
  @IsUUID()
  labelId: string;
}

export class FindPagesByLabelDto {
  @IsOptional()
  @IsUUID()
  labelId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeLabelName(value) : value,
  )
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

export class LabelInfoDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeLabelName(value) : value,
  )
  @MaxLength(100)
  name: string;

  @IsString()
  @IsIn(SUPPORTED_LABEL_TYPES)
  type: LabelType;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

export class ListLabelsDto {
  @IsString()
  @IsIn(SUPPORTED_LABEL_TYPES)
  type: LabelType;
}
