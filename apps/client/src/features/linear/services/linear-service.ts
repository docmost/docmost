import api from "@/lib/api-client";
import {
  ILinearIssueResult,
  ILinearIssueSearchResult,
  ILinearTeamsResult,
} from "../types/linear.types";

// provider key for the generic OAuth2 endpoints (connection + admin config)
export const LINEAR_PROVIDER = "linear";

export async function searchLinearIssues(
  query: string,
): Promise<ILinearIssueSearchResult> {
  const req = await api.post<ILinearIssueSearchResult>(
    "/integrations/linear/issues/search",
    { query },
  );
  return req.data;
}

export async function getLinearIssue(
  issueId: string,
): Promise<ILinearIssueResult> {
  const req = await api.post<ILinearIssueResult>(
    "/integrations/linear/issues/get",
    { issueId },
  );
  return req.data;
}

export async function getLinearTeams(): Promise<ILinearTeamsResult> {
  const req = await api.post<ILinearTeamsResult>("/integrations/linear/teams");
  return req.data;
}

export async function createLinearIssue(input: {
  teamId: string;
  title: string;
  description?: string;
}): Promise<ILinearIssueResult> {
  const req = await api.post<ILinearIssueResult>(
    "/integrations/linear/issues/create",
    input,
  );
  return req.data;
}
