import api from "@/lib/api-client";
import { LinkPreview } from "@/features/link-preview/types/link-preview.types";

export async function getLinkPreview(data: {
  url: string;
  refresh?: boolean;
}): Promise<LinkPreview | null> {
  const req = await api.post<LinkPreview | null>("/links/preview", data);
  return req.data;
}
