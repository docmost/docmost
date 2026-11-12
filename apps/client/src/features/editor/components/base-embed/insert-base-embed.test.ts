import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ default: { post } }));
vi.mock("@/i18n.ts", () => ({ default: { t: (key: string) => key } }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
vi.mock("@/ee/base/utils/viewer-zone", () => ({ getViewerTimeZone: () => "Europe/Berlin" }));

import type { Editor } from "@tiptap/core";
import { insertBaseEmbedBlock } from "./insert-base-embed";

function fakeEditor() {
  const chain = {
    focus: () => chain,
    deleteRange: () => chain,
    insertBaseEmbed: () => chain,
    command: () => chain,
    run: () => true,
  };
  return {
    storage: { pageId: "page-1" },
    chain: () => chain,
    state: { doc: { descendants: () => undefined } },
  } as unknown as Editor;
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: { id: "base-1" } });
});

describe("insertBaseEmbedBlock", () => {
  it("creates the base with the viewer's time zone", async () => {
    await insertBaseEmbedBlock(fakeEditor());
    expect(post).toHaveBeenCalledWith("/bases/create", {
      parentPageId: "page-1",
      timeZone: "Europe/Berlin",
    });
  });

  it("keeps the template next to the zone", async () => {
    await insertBaseEmbedBlock(fakeEditor(), { template: "tasks" as never });
    expect(post.mock.calls[0][1]).toEqual({
      parentPageId: "page-1",
      template: "tasks",
      timeZone: "Europe/Berlin",
    });
  });
});
