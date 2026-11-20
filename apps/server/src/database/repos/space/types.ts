import { User } from '@docmost/db/types/entity.types';

export type SpaceArchivedBy = Pick<User, 'id' | 'name' | 'avatarUrl'>;

export interface UserSpaceRole {
  userId: string;
  role: string;
}

interface SpaceUserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  type: 'user';
}

interface SpaceGroupInfo {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
  type: 'group';
}

export type MemberInfo = SpaceUserInfo | SpaceGroupInfo;

export type UserSpaceIdsOptions = {
  excludeArchived?: boolean;
  keepArchivedSpaceId?: string; // with excludeArchived: still keep this space
};
