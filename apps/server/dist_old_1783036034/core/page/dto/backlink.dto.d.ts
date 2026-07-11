import { PageIdDto } from './page.dto';
export type BacklinkDirection = 'incoming' | 'outgoing';
export declare class BacklinksListDto extends PageIdDto {
    direction: BacklinkDirection;
}
