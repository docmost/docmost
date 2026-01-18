export enum PagePermissionRole {
  READER = "reader",
  WRITER = "writer",
}

export type IAddPagePermission = {
  pageId: string;
  role: PagePermissionRole;
  userIds?: string[];
  groupIds?: string[];
};

export type IRemovePagePermission = {
  pageId: string;
  userIds?: string[];
  groupIds?: string[];
};

export type IUpdatePagePermissionRole = {
  pageId: string;
  role: PagePermissionRole;
  userId?: string;
  groupId?: string;
};

export type IPageRestrictionInfo = {
  id: string;
  title: string;
  hasDirectRestriction: boolean;
  hasInheritedRestriction: boolean;
  userAccess: {
    canView: boolean;
    canEdit: boolean;
    canManage: boolean;
  };
};

type IPagePermissionBase = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export type IPagePermissionUser = IPagePermissionBase & {
  type: "user";
  email: string;
  avatarUrl: string | null;
};

export type IPagePermissionGroup = IPagePermissionBase & {
  type: "group";
  memberCount: number;
  isDefault: boolean;
};

export type IPagePermissionMember = IPagePermissionUser | IPagePermissionGroup;
