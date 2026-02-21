import { IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ListBackupJobsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Min(1)
  limit?: number;
}

export class BackupJobIdDto {
  @IsUUID()
  id: string;
}
