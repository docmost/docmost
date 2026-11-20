import {
  IntegrationCard,
  MicrosoftFile,
  MicrosoftFolder,
} from "@docmost/editor-ext";
import { Editor, type JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertCardToMicrosoftEmbed,
  isEmbeddableMicrosoftKind,
} from "./convert-card";

const mocks = vi.hoisted(() => ({
  resolveMicrosoftUrl: vi.fn(),
  getMicrosoftLibraryRoot: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock("../services/microsoft-service", () => ({
  resolveMicrosoftUrl: mocks.resolveMicrosoftUrl,
  getMicrosoftLibraryRoot: mocks.getMicrosoftLibraryRoot,
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.showNotification },
}));

vi.mock("@/i18n.ts", () => ({
  default: { t: (key: string) => key },
}));

const libraryUrl =
  "https://contoso.sharepoint.com/sites/team/Shared%20Documents";
const url = `${libraryUrl}/Reports`;
const otherUrl = `${libraryUrl}/Plans`;
const listUrl = `${libraryUrl}/Forms/AllItems.aspx`;

const card = (cardUrl = url): JSONContent => ({
  type: "integrationCard",
  attrs: { url: cardUrl, provider: "microsoft_365" },
});

const resolvedLibrary = {
  kind: "list",
  isLibrary: true,
  siteId: "s",
  listId: "l",
  name: "Documents",
  webUrl: listUrl,
};
const libraryRoot = { driveId: "b!d", itemId: "ROOT", webUrl: libraryUrl };

let activeEditor: Editor;
afterEach(() => activeEditor?.destroy());

function createEditor() {
  activeEditor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      IntegrationCard,
      MicrosoftFile,
      MicrosoftFolder,
    ],
    content: { type: "doc", content: [card()] },
  });
  return activeEditor;
}

describe("convertCardToMicrosoftEmbed", () => {
  beforeEach(() => {
    mocks.resolveMicrosoftUrl.mockReset();
    mocks.getMicrosoftLibraryRoot.mockReset();
    mocks.showNotification.mockReset();
  });

  it("embeds a folder card as a folder table", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockResolvedValue({
      kind: "folder",
      driveId: "b!d",
      itemId: "F1",
      webUrl: url,
      name: "Reports",
    });

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(true);

    expect(mocks.resolveMicrosoftUrl).toHaveBeenCalledWith({ url });
    const node = editor.state.doc.firstChild;
    expect(node?.type.name).toBe("microsoftFolder");
    expect(node?.attrs).toEqual({
      driveId: "b!d",
      itemId: "F1",
      webUrl: url,
      name: "Reports",
    });
  });

  it("embeds a document library at its top level", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockResolvedValue(resolvedLibrary);
    mocks.getMicrosoftLibraryRoot.mockResolvedValue(libraryRoot);

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(true);

    expect(mocks.getMicrosoftLibraryRoot).toHaveBeenCalledWith({
      siteId: "s",
      listId: "l",
    });
    const node = editor.state.doc.firstChild;
    expect(node?.type.name).toBe("microsoftFolder");
    expect(node?.attrs).toEqual({
      driveId: "b!d",
      itemId: "ROOT",
      webUrl: libraryUrl,
      name: "Documents",
    });
  });

  it("falls back to the list address when the library root has none", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockResolvedValue(resolvedLibrary);
    mocks.getMicrosoftLibraryRoot.mockResolvedValue({
      ...libraryRoot,
      webUrl: "",
    });

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(true);

    expect(editor.state.doc.firstChild?.attrs.webUrl).toBe(listUrl);
  });

  it("keeps the card for a plain list", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockResolvedValue({
      ...resolvedLibrary,
      isLibrary: false,
      name: "Tasks",
    });

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(false);

    expect(mocks.getMicrosoftLibraryRoot).not.toHaveBeenCalled();
    expect(editor.state.doc.firstChild?.type.name).toBe("integrationCard");
    expect(mocks.showNotification).toHaveBeenCalledWith({
      message: "Only files, folders and document libraries can be embedded",
      color: "red",
    });
  });

  it("still embeds files as file previews", async () => {
    const editor = createEditor();
    const item = {
      driveId: "b!d",
      itemId: "I1",
      webUrl: `${libraryUrl}/Plan.docx`,
      name: "Plan.docx",
    };
    mocks.resolveMicrosoftUrl.mockResolvedValue({ kind: "file", ...item });

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(true);

    const node = editor.state.doc.firstChild;
    expect(node?.type.name).toBe("microsoftFile");
    expect(node?.attrs.items).toEqual([item]);
  });

  it("leaves a card that changed during the library lookup alone", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockResolvedValue(resolvedLibrary);
    mocks.getMicrosoftLibraryRoot.mockImplementation(async () => {
      editor.commands.setContent({ type: "doc", content: [card(otherUrl)] });
      return libraryRoot;
    });

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(false);

    const node = editor.state.doc.firstChild;
    expect(node?.type.name).toBe("integrationCard");
    expect(node?.attrs.url).toBe(otherUrl);
  });

  it("asks to connect Microsoft 365 when the request needs a connection", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockRejectedValue({
      response: { data: { code: "needs_connection" } },
    });

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(false);

    expect(editor.state.doc.firstChild?.type.name).toBe("integrationCard");
    expect(mocks.showNotification).toHaveBeenCalledWith({
      message: "Connect to Microsoft 365 to embed this link",
      color: "red",
    });
  });

  it("reports any other failure, including the library lookup", async () => {
    const editor = createEditor();
    mocks.resolveMicrosoftUrl.mockResolvedValue(resolvedLibrary);
    mocks.getMicrosoftLibraryRoot.mockRejectedValue(new Error("failed"));

    await expect(convertCardToMicrosoftEmbed(editor, 0)).resolves.toBe(false);

    expect(editor.state.doc.firstChild?.type.name).toBe("integrationCard");
    expect(mocks.showNotification).toHaveBeenCalledWith({
      message: "Could not embed this link",
      color: "red",
    });
  });
});

describe("isEmbeddableMicrosoftKind", () => {
  it.each([
    { kind: "file" },
    { kind: "folder" },
    { kind: "list", isLibrary: true },
  ])("accepts %j", (metadata) => {
    expect(isEmbeddableMicrosoftKind(metadata)).toBe(true);
  });

  it.each([
    { kind: "list", isLibrary: false },
    { kind: "site" },
    undefined,
    null,
  ])("rejects %j", (metadata) => {
    expect(isEmbeddableMicrosoftKind(metadata)).toBe(false);
  });
});
