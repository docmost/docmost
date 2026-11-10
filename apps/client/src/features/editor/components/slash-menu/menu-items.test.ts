import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { getSuggestionItems } from "./menu-items";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const editorWhere = (canInsertTabs: boolean) =>
  ({ can: () => ({ insertTabs: () => canInsertTabs }) }) as unknown as Editor;

const titles = (editor?: Editor) =>
  Object.values(getSuggestionItems({ query: "tabs", editor }))
    .flat()
    .map((item) => item.title);

describe("slash menu", () => {
  it("hides Tabs where tabs can't be inserted, such as inside a tab", () => {
    expect(titles(editorWhere(true))).toContain("Tabs");
    expect(titles(editorWhere(false))).not.toContain("Tabs");
  });
});
