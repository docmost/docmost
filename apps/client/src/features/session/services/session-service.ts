import api from "@/lib/api-client";
import { ISession } from "@/features/session/types/session.types";

export async function getSessions(): Promise<ISession[]> {
  const req = await api.post<{ sessions: ISession[] }>("/sessions");
  return req.data.sessions;
}

export async function revokeSession(data: {
  sessionId: string;
}): Promise<void> {
  await api.post("/sessions/revoke", data);
}

export async function revokeAllSessions(): Promise<void> {
  await api.post("/sessions/revoke-all");
}
