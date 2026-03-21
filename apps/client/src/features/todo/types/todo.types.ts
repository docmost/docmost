import { IUser } from "@/features/user/types/user.types";
import { QueryParams } from "@/lib/types.ts";

export interface IPageInfo {
  id: string;
  title: string | null;
  slugId: string;
  icon: string | null;
}

export interface ITodo {
  id: string;
  title: string;
  completed: boolean;
  pageId: string;
  creatorId: string;
  workspaceId: string;
  spaceId?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  creator: IUser;
  page?: IPageInfo;
}

export interface ITodoParams extends QueryParams {
  pageId: string;
}

export interface ISpaceTodoParams extends QueryParams {
  spaceId: string;
}
