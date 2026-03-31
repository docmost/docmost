import { IsString, IsInt, IsBoolean, IsDateString, Min, Max, IsOptional } from 'class-validator';

export class GenerateLicenseDto {
  @IsString()
  customerName: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  seatCount: number;

  @IsDateString()
  expiresAt: string;

  @IsBoolean()
  @IsOptional()
  trial?: boolean;
}
