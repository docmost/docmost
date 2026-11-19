import { User } from '@docmost/db/types/entity.types';

export type ProfileViewer = {
  userId: string;
  workspaceId: string;
  canManageMembers: boolean;
};

export type UserProfile = Pick<
  User,
  | 'id'
  | 'name'
  | 'avatarUrl'
  | 'email'
  | 'role'
  | 'deactivatedAt'
  | 'deletedAt'
>;

export type UserProfileSpace = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

export type UserRecentPageActivity = 'created' | 'edited';

export type UserRecentPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  isBase: boolean;
  spaceId: string;
  space: { id: string; name: string; slug: string; logo: string | null };
  activity: UserRecentPageActivity;
  activityAt: Date;
};
