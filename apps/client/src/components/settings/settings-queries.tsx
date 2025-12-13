import { queryClient } from "@/main.tsx";
import {
  getBilling,
  getBillingPlans,
} from "@/ee/billing/services/billing-service.ts";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { getGroups } from "@/features/group/services/group-service.ts";
import { QueryParams } from "@/lib/types.ts";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service.ts";
import { getLicenseInfo } from "@/ee/licence/services/license-service.ts";
import { getSsoProviders } from "@/ee/security/services/security-service.ts";
import { getShares } from "@/features/share/services/share-service.ts";
import { getApiKeys } from "@/ee/api-key";

export const prefetchWorkspaceMembers = () => {
  const params = { limit: 100, page: 1, query: "" } as QueryParams;
  queryClient.prefetchQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
};

export const prefetchSpaces = () => {
  queryClient.prefetchQuery({
    queryKey: ["spaces", { page: 1 }],
    queryFn: () => getSpaces({ page: 1 }),
  });
};

export const prefetchGroups = () => {
  queryClient.prefetchQuery({
    queryKey: ["groups", { page: 1 }],
    queryFn: () => getGroups({ page: 1 }),
  });
};

export const prefetchBilling = () => {
  queryClient.prefetchQuery({
    queryKey: ["billing"],
    queryFn: () => getBilling(),
  });

  queryClient.prefetchQuery({
    queryKey: ["billing-plans"],
    queryFn: () => getBillingPlans(),
  });
};

export const prefetchLicense = () => {
  queryClient.prefetchQuery({
    queryKey: ["license"],
    queryFn: () => getLicenseInfo(),
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
    queryKey: ["share-list", { page: 1 }],
    queryFn: () => getShares({ page: 1, limit: 100 }),
  });
};

export const prefetchApiKeys = () => {
  queryClient.prefetchQuery({
    queryKey: ["api-key-list", { page: 1 }],
    queryFn: () => getApiKeys({ page: 1 }),
  });
};

export const prefetchApiKeyManagement = () => {
  queryClient.prefetchQuery({
    queryKey: ["api-key-list", { page: 1 }],
    queryFn: () => getApiKeys({ page: 1, adminView: true }),
  });
};
