import { IPage } from "@/features/page/types/page.types.ts";

export interface IPublicSpaceSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}

export interface IPublicSpaceAppearance {
  primaryColorLight?: string;
  primaryColorDark?: string;
}

export interface IPublicSpaceByline {
  author: boolean;
  updatedAt: boolean;
}

export interface IPublicSpaceInfo {
  space: IPublicSpaceSummary;
  searchIndexing: boolean;
  appearance?: IPublicSpaceAppearance;
  features?: string[];
}

export interface IPublicSpaceTree {
  space: IPublicSpaceSummary;
  pageTree: Partial<IPage[]>;
  appearance?: IPublicSpaceAppearance;
  features?: string[];
}

export interface IPublicSpacePage {
  page: IPage | null;
  space: IPublicSpaceSummary;
  searchIndexing: boolean;
  appearance?: IPublicSpaceAppearance;
  byline?: IPublicSpaceByline;
  features?: string[];
}

export interface IPublicSpace {
  id: string;
  spaceId: string;
  workspaceId: string;
  enabled: boolean;
  searchIndexing: boolean;
  settings?: {
    appearance?: IPublicSpaceAppearance;
    byline?: Partial<IPublicSpaceByline>;
    directory?: boolean;
  } | null;
  creatorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IPublishedSpaceItem {
  id: string;
  spaceId: string;
  workspaceId: string;
  searchIndexing: boolean;
  settings?: IPublicSpace["settings"];
  createdAt: string;
  updatedAt: string;
  space: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    userRole: string;
  };
  creator: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface IPublishSpace {
  spaceId: string;
  enabled: boolean;
  searchIndexing?: boolean;
  appearance?: {
    primaryColorLight?: string | null;
    primaryColorDark?: string | null;
  };
  bylineAuthor?: boolean;
  bylineUpdatedAt?: boolean;
  directory?: boolean;
}

export interface IPublicSpaceDirectoryEntry {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}

export interface IPublicSpaceDirectory {
  spaces: IPublicSpaceDirectoryEntry[];
  features?: string[];
}
