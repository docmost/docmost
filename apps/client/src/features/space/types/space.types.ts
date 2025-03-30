import { SpaceRole } from "@/lib/types.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { ExportFormat } from "@/features/page/types/page.types.ts";

export interface ISpace {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
  hostname: string;
  creatorId: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  spaceId?: string;
  membership?: IMembership;
}

interface IMembership {
  userId: string;
  role: SpaceRole;
  permissions?: Permissions;
}

interface Permission {
  action: SpaceCaslAction;
  subject: SpaceCaslSubject;
}

type Permissions = Permission[];

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

export type ISpaceMember = { role: SpaceRole } & (SpaceUserInfo | SpaceGroupInfo);

export interface IExportSpaceParams {
  spaceId: string;
  format: ExportFormat;
  includeAttachments?: boolean;
}

export interface IPublishSpace {
  spaceId: string;
  publish: boolean;
}