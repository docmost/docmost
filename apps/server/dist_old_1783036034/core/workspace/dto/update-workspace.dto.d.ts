import { CreateWorkspaceDto } from './create-workspace.dto';
declare const UpdateWorkspaceDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateWorkspaceDto>>;
export declare class UpdateWorkspaceDto extends UpdateWorkspaceDto_base {
    emailDomains: string[];
    enforceSso: boolean;
    enforceMfa: boolean;
    restrictApiToAdmins: boolean;
    aiSearch: boolean;
    generativeAi: boolean;
    disablePublicSharing: boolean;
    mcpEnabled: boolean;
    isScimEnabled: boolean;
    aiChat: boolean;
    trashRetentionDays: number;
    allowMemberTemplates: boolean;
}
export {};
