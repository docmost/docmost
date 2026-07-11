import { CreateGroupDto } from './create-group.dto';
declare const UpdateGroupDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateGroupDto>>;
export declare class UpdateGroupDto extends UpdateGroupDto_base {
    groupId: string;
}
export {};
