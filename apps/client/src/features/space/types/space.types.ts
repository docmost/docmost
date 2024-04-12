export interface ISpace {
  id: string;
  name: string;
  description: string;
  icon: string;
  hostname: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  spaceId?: string;
}

export interface IAddSpaceMember {
  spaceId: string;
  userIds?: string[];
  groupIds?: string[];
}

export interface IRemoveSpaceMember {
  spaceId: string;
  userId?: string;
  groupId?: string;
}

export interface IChangeSpaceMemberRole {
  spaceId: string;
  userId?: string;
  groupId?: string;
}

// space member
export interface SpaceUserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  type: "user";
}

export interface SpaceGroupInfo {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  type: "group";
}

export type ISpaceMember = { role: string } & (SpaceUserInfo | SpaceGroupInfo);
