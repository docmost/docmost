import { BaseEmbed } from "@docmost/editor-ext";
import { notifications } from "@mantine/notifications";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IPage } from "@/features/page/types/page.types";
import { copyBaseEmbed } from "./copy-base-embed";

vi.mock("@/i18n.ts", () => ({ default: { t: (key: string) => key } }));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));

const page = {
  id: "019a2b3c-0000-7000-8000-000000000001",
  slugId: "x1y2z3",
  title: "Roadmap",
  space: { slug: "general" },
} as IPage;

let clipboardItems: Record<string, Blob>[];

// jsdom's Blob has no text()
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  clipboardItems = [];
  vi.stubGlobal(
    "ClipboardItem",
    class {
      constructor(items: Record<string, Blob>) {
        clipboardItems.push(items);
      }
    },
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(notifications.show).mockReset();
});

describe("copyBaseEmbed", () => {
  it("copies an embed that pastes back as the same base", async () => {
    await copyBaseEmbed(page);
    const html = await readBlob(clipboardItems[0]["text/html"]);

    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [StarterKit, BaseEmbed],
      content: "<p></p>",
    });
    // jsdom has no ClipboardEvent, which pasteHTML would create without one
    editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent);

    const pastedBaseIds: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "base") pastedBaseIds.push(node.attrs.pageId);
    });
    expect(pastedBaseIds).toEqual([page.id]);
    expect(editor.state.doc.textContent).toBe("");
    editor.destroy();
  });

  it("copies the base link as plain text for other apps", async () => {
    await copyBaseEmbed(page);

    expect(await readBlob(clipboardItems[0]["text/plain"])).toBe(
      `${window.location.origin}/s/general/p/roadmap-x1y2z3`,
    );
    expect(notifications.show).toHaveBeenCalledWith({
      message: "Copied. Paste on any page to embed this base.",
    });
  });
});
