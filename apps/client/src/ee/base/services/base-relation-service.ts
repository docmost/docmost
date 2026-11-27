import api from "@/lib/api-client";
import type { IPaginationMeta } from "@/lib/types";
import type { RelationPreview, RelationPreviewRow } from "@/ee/base/types/base.types";

export type RelationTarget = {
  id: string;
  title: string;
  icon: string | null;
  slugId: string;
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
};

export type UpdateRelationLinksInput = {
  pageId: string;
  rowId: string;
  propertyId: string;
  add?: string[];
  remove?: string[];
  requestId?: string;
};

type RelationPage<T> = { items: T[]; meta: IPaginationMeta };

export async function updateRelationLinks(
  data: UpdateRelationLinksInput,
): Promise<{ preview: RelationPreview }> {
  const req = await api.post("/bases/relations/update", data);
  return req.data;
}

export async function listRelationRows(data: {
  pageId: string;
  rowId: string;
  propertyId: string;
  query?: string;
  cursor?: string;
  limit?: number;
}): Promise<RelationPage<RelationPreviewRow>> {
  const req = await api.post("/bases/relations", data);
  return req.data;
}

export async function suggestRelationRows(data: {
  pageId: string;
  propertyId: string;
  rowId?: string;
  query?: string;
  cursor?: string;
}): Promise<RelationPage<RelationPreviewRow>> {
  const req = await api.post("/bases/relations/suggest", data);
  return req.data;
}

export async function resolveRelationRows(data: {
  pageId: string;
  propertyId: string;
  rowIds: string[];
}): Promise<{ items: RelationPreviewRow[] }> {
  const req = await api.post("/bases/relations/resolve", data);
  return req.data;
}

export async function searchRelationTargets(
  query?: string,
): Promise<RelationTarget[]> {
  const req = await api.post("/bases/relations/targets", { query });
  return req.data.items;
}
