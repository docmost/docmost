import { SpaceIdDto } from './space-id.dto';
export declare class AddSpaceMembersDto extends SpaceIdDto {
    role: string;
    userIds: string[];
    groupIds: string[];
}
