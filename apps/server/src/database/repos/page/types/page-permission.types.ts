type PagePermissionUserMember = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  type: 'user';
  role: string;
  createdAt: Date;
};

type PagePermissionGroupMember = {
  id: string;
  name: string;
  memberCount: number;
  isDefault: boolean;
  type: 'group';
  role: string;
  createdAt: Date;
};

export type PagePermissionMember =
  | PagePermissionUserMember
  | PagePermissionGroupMember;
