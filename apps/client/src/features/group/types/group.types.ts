import { IUser } from "@/features/user/types/user.types.ts";
export interface IGroup {
  groupId: string;
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  creatorId: string | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
}

/** A workspace user as returned by the group members endpoint. */
export interface IGroupMember extends IUser {
  /** How the membership was created: "manual" or "google". */
  source?: string;
}
