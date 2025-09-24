import { IPage } from "@/features/page/types/page.types.ts";

export interface IShare {
  id: string;
  key: string;
  pageId: string;
  includeSubPages: boolean;
  searchIndexing: boolean;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sharedPage?: ISharePage;
}

export interface ISharedItem extends IShare {
  page: {
    id: string;
    title: string;
    slugId: string;
    icon: string | null;
  };
  space: {
    id: string;
    name: string;
    slug: string;
    userRole: string;
  };
  creator: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface ISharedPage extends IShare {
  page: IPage;
  share: IShare & {
    level: number;
    sharedPage: { id: string; slugId: string; title: string; icon: string };
  };
  hasLicenseKey: boolean;
}

export interface IShareForPage extends IShare {
  level: number;
  sharedPage: ISharePage;
}

interface ISharePage {
  id: string;
  slugId: string;
  title: string;
  icon: string;
}

export interface ICreateShare {
  pageId?: string;
  includeSubPages?: boolean;
  searchIndexing?: boolean;
}

export type IUpdateShare = ICreateShare & { shareId: string; pageId?: string };

export interface IShareInfoInput {
  pageId: string;
}

export interface ISharedPageTree {
  share: IShare;
  pageTree: Partial<IPage[]>;
  hasLicenseKey: boolean;
}
