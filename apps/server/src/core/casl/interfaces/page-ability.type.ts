export enum PageCaslAction {
  Manage = 'manage',
  Read = 'read',
  Edit = 'edit',
  Move = 'move',
  Delete = 'delete',
}
export enum PageCaslSubject {
  Member = 'member',
  Page = 'page',
}

export type IPageAbility =
  | [PageCaslAction, PageCaslSubject.Member]
  | [PageCaslAction, PageCaslSubject.Page];
