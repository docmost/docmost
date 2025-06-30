import { IsNotEmpty, IsString, Length } from 'class-validator';

export class EnableTotpDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  token: string;

  @IsNotEmpty()
  @IsString()
  secret: string;
}

export class DisableTotpDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 8)
  token: string;
}

export class VerifyTotpDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 8)
  token: string;
}
