import { act, render, waitFor } from "@testing-library/react";
import { type Editor } from "@tiptap/core";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { TitleEditor } from "./title-editor";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/features/page/queries/page-query", () => ({
  useUpdateTitlePageMutation: () => ({ mutateAsync: save }),
  updatePageData: vi.fn(),
}));
vi.mock("@/features/websocket/use-query-emit.ts", () => ({
  useQueryEmit: () => vi.fn(),
}));
vi.mock("@/ee/page-verification/hooks/use-page-edit-mode", () => ({
  usePageEditMode: () => ({ editMode: "edit", isCheckingLock: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (text: string) => text }),
}));
vi.mock("@/features/editor/extensions/emoji-command.ts", async () => {
  const { Extension } = await import("@tiptap/core");
  return { default: Extension.create({ name: "emojiCommand" }) };
});

it("saves the final title on navigation even when it matches the initial title", async () => {
  save.mockImplementation(async ({ title }) => ({ id: "page-a", title }));
  const page = (title: string) => (
    <MemoryRouter>
      <TitleEditor
        pageId="page-a"
        slugId="slug"
        spaceSlug="space"
        title={title}
        editable
      />
    </MemoryRouter>
  );
  const { container, rerender, unmount } = render(page("Original"));
  const element = container.querySelector(
    '[aria-label="Page title"]',
  ) as HTMLElement & { editor: Editor };
  act(() => {
    element.editor.commands.setContent("Renamed", { emitUpdate: true });
  });
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ pageId: "page-a", title: "Renamed" }),
  );
  rerender(page("Renamed"));
  act(() => {
    element.editor.commands.setContent("Original", { emitUpdate: true });
  });
  unmount();
  expect(save.mock.calls.map(([value]) => value.title)).toEqual([
    "Renamed",
    "Original",
  ]);
});
