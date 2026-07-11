import { SpaceIdDto } from './space-id.dto';
export declare class UpdateSpaceMemberRoleDto extends SpaceIdDto {
    userId: string;
    groupId: string;
    role: string;
}
