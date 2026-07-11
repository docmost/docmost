export declare class CreateGroupDto {
    name: string;
    description?: string;
    userIds?: string[];
}
export declare enum DefaultGroup {
    EVERYONE = "Everyone",
    DESCRIPTION = "Group for all users in this workspace."
}
