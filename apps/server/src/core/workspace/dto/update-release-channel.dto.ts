import { IsIn, IsString } from 'class-validator';
import { ReleaseChannel } from '@docmost/db/repos/workspace/workspace-release-channel.repo';

export class UpdateReleaseChannelDto {
  @IsString()
  @IsIn(['prod', 'staging'])
  releaseChannel: ReleaseChannel;
}
