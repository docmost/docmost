import { IsIn, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class AddExternalRefDto {
  @IsUUID()
  changeRequestId: string;

  @IsIn(['PR', 'COMMIT', 'TICKET', 'BUILD'])
  refType: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  label?: string;
}
