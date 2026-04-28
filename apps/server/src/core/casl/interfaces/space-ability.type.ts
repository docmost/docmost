export enum SpaceCaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
}
export enum SpaceCaslSubject {
  Settings = 'settings',
  Member = 'member',
  Page = 'page',
  Share = 'share',
}

// Bases are pages (isBase=true) and inherit Page permissions. There
// used to be a separate `Base` subject here; it duplicated Page in
// every role's casl rules, so callers that needed to check base
// access just used Page (via pageAccessService) anyway. Dropped to
// keep one source of truth.
export type ISpaceAbility =
  | [SpaceCaslAction, SpaceCaslSubject.Settings]
  | [SpaceCaslAction, SpaceCaslSubject.Member]
  | [SpaceCaslAction, SpaceCaslSubject.Page]
  | [SpaceCaslAction, SpaceCaslSubject.Share];
