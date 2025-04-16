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
    sharedPage: { id: string; slugId: string; title: string };
  };
}

export interface IShareForPage extends IShare {
  level: number;
  page: {
    id: string;
    title: string;
    slugId: string;
  };
  sharedPage: {
    id: string;
    slugId: string;
    title: string;
  };
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
}
