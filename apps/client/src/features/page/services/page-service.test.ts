import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { updatePage } from "./page-service";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(api.post).mockResolvedValue({ data: { id: "page-1" } });
});

describe("updatePage", () => {
  it("targets the draft so approval-controlled pages accept title and icon edits", async () => {
    await updatePage({ pageId: "page-1", title: "New title" });

    expect(api.post).toHaveBeenCalledWith("/pages/update", {
      pageId: "page-1",
      title: "New title",
      draft: true,
    });
  });
});
