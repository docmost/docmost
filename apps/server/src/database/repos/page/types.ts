export interface UserPageRole {
  userId: string;
  role: string;
}

interface PageUserIfnfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  type: 'user';
}

interface PageGroupInfo {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  type: 'group';
}

export type MemberInfo = PageUserIfnfo | PageGroupInfo;
