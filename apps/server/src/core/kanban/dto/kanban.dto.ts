import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsDueDateInRange } from '../../../common/validators/is-due-date-in-range';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SpaceBoardDto {
  @IsUUID()
  spaceId: string;
}

export class BoardIdDto {
  @IsUUID()
  boardId: string;
}

export class CreateBoardDto extends SpaceBoardDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;
}

export class UpdateBoardDto extends BoardIdDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;
}

export class ColumnIdDto extends BoardIdDto {
  @IsUUID()
  columnId: string;
}

export class CreateColumnDto extends BoardIdDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[0-9A-Za-z]+$/)
  position: string;
}

export class UpdateColumnDto extends ColumnIdDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;
}

export class MoveColumnDto extends ColumnIdDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[0-9A-Za-z]+$/)
  position: string;
}

export class CardIdDto extends BoardIdDto {
  @IsUUID()
  cardId: string;
}

export class CardFieldsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  @IsDueDateInRange()
  dueDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  labels?: string[];
}

export class CreateCardDto extends CardFieldsDto {
  @IsUUID()
  boardId: string;

  @IsUUID()
  columnId: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[0-9A-Za-z]+$/)
  position: string;
}

export class UpdateCardDto extends CardFieldsDto {
  @IsUUID()
  boardId: string;

  @IsUUID()
  cardId: string;
}

export class MoveCardDto extends CardIdDto {
  @IsUUID()
  columnId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[0-9A-Za-z]+$/)
  position: string;
}
