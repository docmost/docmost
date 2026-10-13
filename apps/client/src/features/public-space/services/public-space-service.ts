import api from "@/lib/api-client";
import { IPagination, QueryParams } from "@/lib/types.ts";
import {
  IPublicSpace,
  IPublicSpaceDirectory,
  IPublicSpaceInfo,
  IPublicSpacePage,
  IPublicSpaceTree,
  IPublishedSpaceItem,
  IPublishSpace,
} from "@/features/public-space/types/public-space.types.ts";

export async function getPublishedSpaces(
  params?: QueryParams,
): Promise<IPagination<IPublishedSpaceItem>> {
  const req = await api.post<IPagination<IPublishedSpaceItem>>(
    "/public-spaces",
    params,
  );
  return req.data;
}

export async function getPublicSpaceInfo(
  spaceSlug: string,
): Promise<IPublicSpaceInfo> {
  const req = await api.post<IPublicSpaceInfo>("/public-spaces/info", {
    spaceSlug,
  });
  return req.data;
}

export async function getPublicSpaceTree(
  spaceSlug: string,
): Promise<IPublicSpaceTree> {
  const req = await api.post<IPublicSpaceTree>("/public-spaces/tree", {
    spaceSlug,
  });
  return req.data;
}

export async function getPublicSpacePage(params: {
  spaceSlug: string;
  pageSlugId?: string;
  contentless?: boolean;
}): Promise<IPublicSpacePage> {
  const req = await api.post<IPublicSpacePage>(
    "/public-spaces/page-info",
    params,
  );
  return req.data;
}

export async function getPublicSpaceDirectory(): Promise<IPublicSpaceDirectory> {
  const req = await api.post<IPublicSpaceDirectory>(
    "/public-spaces/directory",
    {},
  );
  return req.data;
}

export async function getPublicSpaceForSpace(
  spaceId: string,
): Promise<IPublicSpace | null> {
  const req = await api.post<IPublicSpace | null>("/public-spaces/for-space", {
    spaceId,
  });
  return req.data;
}

export async function publishSpace(data: IPublishSpace): Promise<IPublicSpace> {
  const req = await api.post<IPublicSpace>("/public-spaces/publish", data);
  return req.data;
}
