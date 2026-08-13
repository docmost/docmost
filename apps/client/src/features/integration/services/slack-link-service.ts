import api from "@/lib/api-client";

export type SlackLinkStateInfo = {
  slackUserName: string;
  slackUserId: string;
  slackTeamId: string;
  slackTeamName: string | null;
  integrationWorkspaceId: string | undefined;
};

export async function decodeSlackLinkState(
  state: string,
): Promise<SlackLinkStateInfo> {
  const req = await api.post<SlackLinkStateInfo>(
    "/integrations/slack/link/state",
    { state },
  );
  return req.data;
}

export async function confirmSlackLink(state: string): Promise<void> {
  await api.post("/integrations/slack/link", { state });
}
