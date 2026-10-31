import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PageIdDto } from './page.dto.js';

export type BacklinkDirection = 'incoming' | 'outgoing';

export class BacklinksListDto extends PageIdDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['incoming', 'outgoing'])
  direction: BacklinkDirection;
}
