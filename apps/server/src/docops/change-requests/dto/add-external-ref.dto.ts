import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class AddExternalRefDto {
  @IsUUID()
  changeRequestId: string;

  @IsIn(['PR', 'COMMIT', 'TICKET', 'BUILD'])
  refType: string;

  @IsString()
  @MinLength(7)
  url: string;

  @IsOptional()
  @IsString()
  label?: string;
}
