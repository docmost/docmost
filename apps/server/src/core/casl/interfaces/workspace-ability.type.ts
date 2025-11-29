export enum WorkspaceCaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
}
export enum WorkspaceCaslSubject {
  Settings = 'settings',
  Member = 'member',
  Space = 'space',
  Group = 'group',
  Attachment = 'attachment',
  API = 'api_key',
}

export type IWorkspaceAbility =
  | [WorkspaceCaslAction, WorkspaceCaslSubject.Settings]
  | [WorkspaceCaslAction, WorkspaceCaslSubject.Member]
  | [WorkspaceCaslAction, WorkspaceCaslSubject.Space]
  | [WorkspaceCaslAction, WorkspaceCaslSubject.Group]
  | [WorkspaceCaslAction, WorkspaceCaslSubject.Attachment]
  | [WorkspaceCaslAction, WorkspaceCaslSubject.API];
