import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class AiAnswerDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  shareId?: string;
}
