import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinearSearchDto {
  @IsString()
  query: string;
}

export class LinearIssueIdDto {
  @IsString()
  issueId: string;
}

export class LinearCreateIssueDto {
  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
