import { describe, expect, it, vi, beforeEach } from "vitest";
import api from "@/lib/api-client";
import { getInviteLink, getInvitationById } from "./workspace-service";

vi.mock("@/lib/api-client", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("workspace-service invitation API unboxing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getInviteLink returns unboxed payload from api.post", async () => {
    const mockPayload = { inviteLink: "http://localhost:3000/invites/inv-123?token=token-abc" };
    (api.post as any).mockResolvedValue(mockPayload);

    const result = await getInviteLink({ invitationId: "inv-123" });

    expect(api.post).toHaveBeenCalledWith("/workspace/invites/link", { invitationId: "inv-123" });
    expect(result).toEqual(mockPayload);
    expect(result.inviteLink).toBe("http://localhost:3000/invites/inv-123?token=token-abc");
  });

  it("getInvitationById returns unboxed payload from api.post", async () => {
    const mockPayload = {
      id: "inv-123",
      email: "user@example.com",
      role: "member",
      workspaceId: "ws-1",
      invitedById: "user-1",
      createdAt: new Date(),
      enforceSso: false,
    };
    (api.post as any).mockResolvedValue(mockPayload);

    const result = await getInvitationById({ invitationId: "inv-123" });

    expect(api.post).toHaveBeenCalledWith("/workspace/invites/info", { invitationId: "inv-123" });
    expect(result).toEqual(mockPayload);
    expect(result.email).toBe("user@example.com");
  });
});
