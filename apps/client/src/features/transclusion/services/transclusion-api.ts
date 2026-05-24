import api from "@/lib/api-client";
import type {
  ReferencingPagesResponse,
  TransclusionLookup,
} from "../types/transclusion.types";

export async function lookupTransclusion(params: {
  references: Array<{ sourcePageId: string; transclusionId: string }>;
}): Promise<{ items: TransclusionLookup[] }> {
  const r = await api.post("/pages/transclusion/lookup", params);
  return r.data;
}

export async function lookupTransclusionForShare(params: {
  shareId: string;
  references: Array<{ sourcePageId: string; transclusionId: string }>;
}): Promise<{ items: TransclusionLookup[] }> {
  const r = await api.post("/shares/transclusion/lookup", params);
  return r.data;
}

export async function listReferences(params: {
  sourcePageId: string;
  transclusionId: string;
}): Promise<ReferencingPagesResponse> {
  const r = await api.post("/pages/transclusion/references", params);
  return r.data;
}

export async function unsyncReference(params: {
  referencePageId: string;
  sourcePageId: string;
  transclusionId: string;
}): Promise<{ content: unknown }> {
  const r = await api.post("/pages/transclusion/unsync-reference", params);
  return r.data;
}
