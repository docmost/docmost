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
  Base = 'base',
}

export type ISpaceAbility =
  | [SpaceCaslAction, SpaceCaslSubject.Settings]
  | [SpaceCaslAction, SpaceCaslSubject.Member]
  | [SpaceCaslAction, SpaceCaslSubject.Page]
  | [SpaceCaslAction, SpaceCaslSubject.Share]
  | [SpaceCaslAction, SpaceCaslSubject.Base];
