import { IsIn, IsString } from 'class-validator';

export class UseOAuthAvatarDto {
  @IsString()
  @IsIn(['gitea', 'azure'])
  provider: string;
}
