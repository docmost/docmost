import { queryClient } from "@/main.tsx";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { getGroups } from "@/features/group/services/group-service.ts";
import { QueryParams } from "@/lib/types.ts";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service.ts";
import { getSsoProviders } from "@/ee/security/services/security-service.ts";
import { getShares } from "@/features/share/services/share-service.ts";
import { getApiKeys } from "@/ee/api-key";
import { getAuditLogs } from "@/ee/audit/services/audit-service";
import { getVerificationList } from "@/ee/page-verification/services/page-verification-service";
import { getScimTokens } from "@/ee/scim/services/scim-token-service";

export const prefetchWorkspaceMembers = () => {
  const params: QueryParams = { limit: 100, query: "" };
  queryClient.prefetchQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
};

export const prefetchSpaces = () => {
  queryClient.prefetchQuery({
    queryKey: ["spaces", {}],
    queryFn: () => getSpaces({}),
  });
};

export const prefetchGroups = () => {
  queryClient.prefetchQuery({
    queryKey: ["groups", {}],
    queryFn: () => getGroups({}),
  });
};

export const prefetchSsoProviders = () => {
  queryClient.prefetchQuery({
    queryKey: ["sso-providers"],
    queryFn: () => getSsoProviders(),
  });
};

export const prefetchShares = () => {
  queryClient.prefetchQuery({
    queryKey: ["share-list", {}],
    queryFn: () => getShares({}),
  });
};

export const prefetchApiKeys = () => {
  queryClient.prefetchQuery({
    queryKey: ["api-key-list", {}],
    queryFn: () => getApiKeys({}),
  });
};

export const prefetchApiKeyManagement = () => {
  queryClient.prefetchQuery({
    queryKey: ["api-key-list", { adminView: true }],
    queryFn: () => getApiKeys({ adminView: true }),
  });
};

export const prefetchAuditLogs = () => {
  const params = { limit: 50 };
  queryClient.prefetchQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => getAuditLogs(params),
  });
};

export const prefetchVerifiedPages = () => {
  const params = { limit: 50 };
  queryClient.prefetchQuery({
    queryKey: ["verification-list", params],
    queryFn: () => getVerificationList(params),
  });
};

export const prefetchScimTokens = () => {
  queryClient.prefetchQuery({
    queryKey: ["scim-token-list", { cursor: undefined }],
    queryFn: () => getScimTokens({}),
  });
};
