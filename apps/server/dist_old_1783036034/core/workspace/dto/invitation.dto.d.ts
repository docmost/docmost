export declare class InviteUserDto {
    emails: string[];
    groupIds: string[];
    role: string;
}
export declare class InvitationIdDto {
    invitationId: string;
}
export declare class AcceptInviteDto extends InvitationIdDto {
    name: string;
    password: string;
    token: string;
}
export declare class RevokeInviteDto extends InvitationIdDto {
}
