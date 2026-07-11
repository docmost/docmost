import { Workspace } from "../../database/types/entity.types";
export declare function computeEmailSignature(email: string, workspaceId: string, appSecret: string): string;
export declare function throwIfEmailNotVerified(opts: {
    isCloud: boolean;
    emailVerifiedAt: Date | null;
    email: string;
    workspaceId: string;
    appSecret: string;
}): void;
export declare function validateSsoEnforcement(workspace: Workspace): void;
export declare function validateAllowedEmail(userEmail: string, workspace: Workspace): void;
