import { useM365Request } from "../hooks/use-m365-request";
import * as microsoftService from "../services/microsoft-service";

const PREVIEW_STALE_MS = 45_000;

export function useM365Item(driveId: string, itemId: string, enabled = true) {
  return useM365Request(
    ["m365", "item", driveId, itemId],
    () => microsoftService.getMicrosoftItem({ driveId, itemId }),
    { enabled: enabled && Boolean(driveId && itemId) },
  );
}

export function useM365Preview(driveId: string, itemId: string, enabled = true) {
  return useM365Request(
    ["m365", "preview", driveId, itemId],
    () => microsoftService.getMicrosoftPreview({ driveId, itemId }),
    { enabled: enabled && Boolean(driveId && itemId), staleTime: PREVIEW_STALE_MS, gcTime: 60_000 },
  );
}

export function useM365Recent(enabled = true) {
  return useM365Request(["m365", "recent"], microsoftService.listMicrosoftRecent, {
    enabled,
    staleTime: 0,
  });
}

export function useM365SharedWithMe(enabled = true) {
  return useM365Request(["m365", "shared-with-me"], microsoftService.listMicrosoftSharedWithMe, {
    enabled,
    staleTime: 0,
  });
}

export function useM365Sites(query: string, enabled = true) {
  return useM365Request(
    ["m365", "sites", query],
    () => microsoftService.listMicrosoftSites({ query: query || undefined }),
    { enabled },
  );
}

export function useM365Drives(siteId: string | null, enabled = true) {
  return useM365Request(
    ["m365", "drives", siteId],
    () => microsoftService.listMicrosoftDrives({ siteId: siteId as string }),
    { enabled: enabled && Boolean(siteId) },
  );
}

export function useM365Children(
  driveId: string | null,
  itemId: string | null,
  pageToken: string | undefined,
  enabled = true,
) {
  return useM365Request(
    ["m365", "children", driveId, itemId, pageToken ?? null],
    () =>
      microsoftService.listMicrosoftChildren({
        driveId: driveId as string,
        itemId: itemId ?? undefined,
        pageToken,
      }),
    { enabled: enabled && Boolean(driveId) },
  );
}

export function useM365Search(query: string, siteId: string | null, enabled = true) {
  return useM365Request(
    ["m365", "search", query, siteId],
    () => microsoftService.searchMicrosoft({ query, siteId: siteId ?? undefined }),
    { enabled: enabled && query.trim().length >= 2, staleTime: 0 },
  );
}
