export enum PageCaslAction {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
}
export enum PageCaslSubject {
  Settings = 'settings',
  Member = 'member',
  Page = 'page',
}

export type IPageAbility =
  | [PageCaslAction, PageCaslSubject.Settings]
  | [PageCaslAction, PageCaslSubject.Member]
  | [PageCaslAction, PageCaslSubject.Page];
