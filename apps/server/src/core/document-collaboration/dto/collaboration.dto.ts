import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CollaborationPageDto {
  @IsUUID() pageId: string;
}
export class CreateDocumentTaskDto extends CollaborationPageDto {
  @Transform(trim) @IsString() @Length(1, 200) title: string;
  @IsUUID() assigneeId: string;
  @IsOptional() @IsISO8601({ strict: true }) dueAt?: string | null;
}
export class TaskIdDto {
  @IsUUID() taskId: string;
}
export class UpdateDocumentTaskDto extends TaskIdDto {
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsUUID() assigneeId?: string;
  @IsOptional() @IsISO8601({ strict: true }) dueAt?: string | null;
}
export class CollaborationListDto {
  @IsOptional() @IsUUID() pageId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @ValidateIf((_o, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
export class TaskListDto extends CollaborationListDto {
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['all', 'pending', 'completed', 'cancelled', 'overdue'])
  status: string = 'pending';
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['assigned', 'created'])
  scope: string = 'assigned';
}
export class CollaborationMembersDto extends CollaborationPageDto {
  @IsOptional() @Transform(trim) @IsString() @Length(0, 100) query = '';
  @IsOptional() @IsUUID() cursor?: string;
}
export class CreateReadingBatchDto extends CollaborationPageDto {
  @Transform(trim) @IsString() @Length(1, 200) title: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  recipientIds: string[];
  @IsString() @Matches(/^[a-f0-9]{64}$/) expectedHash: string;
}
export class BatchIdDto {
  @IsUUID() batchId: string;
}
export class ConfirmReadingDto extends BatchIdDto {
  @IsBoolean() acknowledged: boolean;
}
export class ReadingListDto extends CollaborationListDto {
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['received', 'created'])
  scope: string = 'received';
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(['all', 'pending', 'confirmed', 'open', 'closed', 'revoked'])
  status: string = 'all';
}
