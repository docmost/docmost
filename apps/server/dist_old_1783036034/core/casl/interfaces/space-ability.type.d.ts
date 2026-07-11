export declare enum SpaceCaslAction {
    Manage = "manage",
    Create = "create",
    Read = "read",
    Edit = "edit",
    Delete = "delete"
}
export declare enum SpaceCaslSubject {
    Settings = "settings",
    Member = "member",
    Page = "page",
    Share = "share"
}
export type ISpaceAbility = [SpaceCaslAction, SpaceCaslSubject.Settings] | [SpaceCaslAction, SpaceCaslSubject.Member] | [SpaceCaslAction, SpaceCaslSubject.Page] | [SpaceCaslAction, SpaceCaslSubject.Share];
