export enum SpaceCaslAction {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Edit = "edit",
  Delete = "delete",
}
export enum SpaceCaslSubject {
  Settings = "settings",
  Member = "member",
  Page = "page",
}

// Bases are pages and inherit Page permissions — a separate Base
// subject was redundant and has been dropped from the server's casl
// rules too. Anything that used to check Base now checks Page.
export type SpaceAbility =
  | [SpaceCaslAction, SpaceCaslSubject.Settings]
  | [SpaceCaslAction, SpaceCaslSubject.Member]
  | [SpaceCaslAction, SpaceCaslSubject.Page];
