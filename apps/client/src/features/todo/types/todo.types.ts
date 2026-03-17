import { IUser } from "@/features/user/types/user.types";
import { QueryParams } from "@/lib/types.ts";

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
}

export interface ITodoParams extends QueryParams {
  pageId: string;
}
