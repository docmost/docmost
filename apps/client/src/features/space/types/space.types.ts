import { SpaceRole } from "@/lib/types.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { ExportFormat } from "@/features/page/types/page.types.ts";

export interface ISpaceSharingSettings {
  disabled?: boolean;
}

export interface ISpaceExportSettings {
  disabled?: boolean;
}

export interface ISpaceCommentsSettings {
  allowViewerComments?: boolean;
}

export interface ISpaceSettings {
  sharing?: ISpaceSharingSettings;
  export?: ISpaceExportSettings;
  comments?: ISpaceCommentsSettings;
}

export type ISpaceHomePage = {
  id: string;
  slugId: string;
  title: string;
  icon: string | null;
};

export interface ISpace {
  id: string;
  name: string;
  description: string;
  logo?: string;
  slug: string;
  isPersonal?: boolean;
  hostname: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date | null;
  archivedById?: string | null;
  archivedBy?: { id: string; name: string; avatarUrl: string } | null;
  memberCount?: number;
  isPublished?: boolean;
  spaceId?: string;
  membership?: IMembership;
  settings?: ISpaceSettings;
  homePageId?: string | null;
  homePage?: ISpaceHomePage | null;
  // for updates
  disablePublicSharing?: boolean;
  disableExport?: boolean;
  allowViewerComments?: boolean;
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

export type ISpaceMember = { role: string } & (SpaceUserInfo | SpaceGroupInfo);

export interface IExportSpaceParams {
  spaceId: string;
  format: ExportFormat;
  includeAttachments?: boolean;
}
