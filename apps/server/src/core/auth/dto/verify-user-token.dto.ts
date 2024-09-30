import { IsString, MinLength } from 'class-validator';

export class VerifyUserTokenDto {
  @IsString()
  token: string;

  @IsString()
  type: string;
}
