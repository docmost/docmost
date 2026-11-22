import api from "@/lib/api-client";
import {
  ConfluenceCredentials,
  ConfluencePageHistoryMode,
  ConfluenceSpaceBatch,
  ConfluenceSpacePosition,
  ImportStatusResponse,
  ListImportsResponse,
  StartImportResponse,
  TestConnectionResponse,
} from "@/ee/confluence-import/types/confluence-import.types";

export async function testConfluenceConnection(
  data: ConfluenceCredentials,
  signal?: AbortSignal,
): Promise<TestConnectionResponse> {
  const req = await api.post<TestConnectionResponse>(
    "/confluence-import/test-connection",
    data,
    { params: { includeSpaces: false }, timeout: 30_000, signal },
  );
  return req.data;
}

export async function getConfluenceSpaceBatch(
  credentials: ConfluenceCredentials,
  position: ConfluenceSpacePosition,
  signal: AbortSignal,
): Promise<ConfluenceSpaceBatch> {
  const { data } = await api.post<
    | ({ success: true } & ConfluenceSpaceBatch)
    | { success: false; error: string }
  >("/confluence-import/spaces", { ...credentials, ...position }, { signal });
  if (data.success === false) throw new Error(data.error);
  return data;
}

export async function startConfluenceImport(
  data: ConfluenceCredentials & {
    spaceKeys?: string[];
    fullEnumeration?: boolean;
    pageHistoryMode?: ConfluencePageHistoryMode;
    includeBlueprints?: boolean;
    includeBlogPosts?: boolean;
  },
): Promise<StartImportResponse> {
  const req = await api.post<StartImportResponse>(
    "/confluence-import/start",
    data,
  );
  return req.data;
}

export async function getConfluenceImportStatus(
  fileTaskId: string,
): Promise<ImportStatusResponse> {
  const req = await api.post<ImportStatusResponse>(
    "/confluence-import/status",
    { fileTaskId },
  );
  return req.data;
}

export async function listConfluenceImports(): Promise<ListImportsResponse> {
  const req = await api.post<ListImportsResponse>("/confluence-import/history");
  return req.data;
}

export async function cancelConfluenceImport(
  fileTaskId: string,
): Promise<{ success: boolean }> {
  const req = await api.post<{ success: boolean }>(
    "/confluence-import/cancel",
    { fileTaskId },
  );
  return req.data;
}
