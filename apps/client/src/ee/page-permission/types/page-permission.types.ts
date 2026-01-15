export enum PagePermissionRole {
  READER = "reader",
  WRITER = "writer",
}

export type IRestrictPage = {
  pageId: string;
};

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

export type IRemovePageRestriction = {
  pageId: string;
};

export type IPagePermission = {
  id: string;
  pageId: string;
  role: PagePermissionRole;
  userId?: string;
  groupId?: string;
  user?: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  group?: {
    id: string;
    name: string;
  };
};

export type IPageRestrictionInfo = {
  isRestricted: boolean;
  hasAccess: boolean;
  role?: PagePermissionRole;
};
