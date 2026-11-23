import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import {
  RecentlyUpdated,
  type RecentlyUpdatedAttributes,
} from "@docmost/editor-ext";
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

const editorWhere = (canInsertTabs: boolean, canEditPlaceholder = false) =>
  ({
    can: () => ({
      insertTabs: () => canInsertTabs,
      editTemplatePlaceholder: () => canEditPlaceholder,
    }),
  }) as unknown as Editor;

const titles = (query: string, editor?: Editor) =>
  Object.values(getSuggestionItems({ query, editor }))
    .flat()
    .map((item) => item.title);

describe("slash menu", () => {
  it("hides Tabs where tabs can't be inserted, such as inside a tab", () => {
    expect(titles("tabs", editorWhere(true))).toContain("Tabs");
    expect(titles("tabs", editorWhere(false))).not.toContain("Tabs");
  });

  it("offers the placeholder command only where an author can insert one", () => {
    expect(titles("placeholder", editorWhere(true, true))).toContain(
      "Placeholder text",
    );
    expect(titles("placeholder", editorWhere(true))).not.toContain(
      "Placeholder text",
    );
  });

  it.each(["calendrier", "aujourd'hui", "aujourd’hui", "calendar", "today"])(
    "finds Date by the keyword %s in a French interface",
    (query) => expect(titles(query)).toContain("Date"),
  );
});

describe("inserting a recently updated block", () => {
  let editor: Editor;
  const design = "de44053e-d614-453b-9706-1737faf19b87";
  const engineering = "dcb7b4d5-a068-448d-9f18-e8b0684ee57e";
  afterEach(() => editor?.destroy());

  it("keeps the paragraphs on either side when replacing a slash command", () => {
    editor = new Editor({
      extensions: [StarterKit, RecentlyUpdated],
      content: "<p>Before</p><p>/recent</p><p>After</p>",
    });
    editor.commands.setTextSelection(16);
    const item = Object.values(getSuggestionItems({ query: "recent" }))
      .flat()
      .find(({ title }) => title === "Recently updated");
    expect(item).toBeDefined();
    item!.command({ editor, range: { from: 9, to: 16 } });
    expect(editor.getJSON().content).toMatchObject([
      { type: "paragraph", content: [{ text: "Before" }] },
      {
        type: "recentlyUpdated",
        attrs: {
          limit: 15,
          hideHeading: false,
          scope: "current",
          spaceIds: [],
          labels: [],
        },
      },
      { type: "paragraph", content: [{ text: "After" }] },
    ]);
  });

  it("copies the chosen filters and bounds the number of results", () => {
    editor = new Editor({ extensions: [StarterKit, RecentlyUpdated] });
    const filters = {
      scope: "spaces" as const,
      spaceIds: [design],
      excludeSpaceIds: [engineering],
      labels: ["+release"],
      excludeLabels: ["old"],
    };
    editor.commands.insertRecentlyUpdated({
      limit: 350,
      hideHeading: true,
      ...filters,
    });
    filters.spaceIds.pop();
    filters.excludeSpaceIds.pop();
    filters.excludeLabels.pop();
    filters.labels.pop();
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: "recentlyUpdated",
      attrs: {
        limit: 200,
        hideHeading: true,
        scope: "spaces",
        spaceIds: [design],
        excludeSpaceIds: [engineering],
        labels: ["+release"],
        excludeLabels: ["old"],
      },
    });
  });

  it.each([
    { options: { limit: 3 }, expected: "current" },
    { options: { spaceIds: [] }, expected: "current" },
    { options: { excludeSpaceIds: [engineering] }, expected: "current" },
    { options: { scope: "workspace" }, expected: "workspace" },
    { options: { scope: "spaces", spaceIds: [] }, expected: "spaces" },
  ] satisfies {
    options: Partial<RecentlyUpdatedAttributes>;
    expected: RecentlyUpdatedAttributes["scope"];
  }[])(
    "keeps the requested scope when inserting with $options",
    ({ options, expected }) => {
      editor = new Editor({ extensions: [StarterKit, RecentlyUpdated] });
      editor.commands.insertRecentlyUpdated(options);
      expect(editor.getJSON().content[0].attrs).toMatchObject({
        scope: expected,
        spaceIds: [],
      });
    },
  );
});
