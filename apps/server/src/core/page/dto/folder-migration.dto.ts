import { IsUUID } from 'class-validator';

export class StartFolderMigrationDto {
  @IsUUID()
  spaceId: string;
}

export class RollbackFolderMigrationDto {
  @IsUUID()
  jobId: string;
}
