import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AI_ACTION_IDS } from '../prompts';

export class AiGenerateDto {
  @IsOptional()
  @IsString()
  @IsIn(AI_ACTION_IDS as unknown as string[])
  action?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}
