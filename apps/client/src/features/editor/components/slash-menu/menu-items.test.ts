import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { getSuggestionItems } from "./menu-items";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

vi.mock("@/i18n.ts", async () => {
  const { createInstance } = await import("i18next");
  const i18n = createInstance();
  await i18n.init({
    lng: "fr-FR",
    resources: {
      "fr-FR": {
        translation: { Today: "Aujourd'hui", Calendar: "Calendrier" },
      },
    },
  });
  return { default: i18n };
});

const editorWhere = (canInsertTabs: boolean) =>
  ({ can: () => ({ insertTabs: () => canInsertTabs }) }) as unknown as Editor;

const titles = (query: string, editor?: Editor) =>
  Object.values(getSuggestionItems({ query, editor }))
    .flat()
    .map((item) => item.title);

describe("slash menu", () => {
  it("hides Tabs where tabs can't be inserted, such as inside a tab", () => {
    expect(titles("tabs", editorWhere(true))).toContain("Tabs");
    expect(titles("tabs", editorWhere(false))).not.toContain("Tabs");
  });

  it.each(["calendrier", "aujourd'hui", "aujourd’hui", "calendar", "today"])(
    "finds Date by the keyword %s in a French interface",
    (query) => expect(titles(query)).toContain("Date"),
  );
});
