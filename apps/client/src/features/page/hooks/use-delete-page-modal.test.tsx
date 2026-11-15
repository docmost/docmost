import { render, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useDeletePageModal } from "./use-delete-page-modal.tsx";

const mocks = vi.hoisted(() => ({
  openConfirmModal: vi.fn(),
}));

vi.mock("@mantine/modals", () => ({
  modals: { openConfirmModal: mocks.openConfirmModal },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));

vi.mock("@mantine/core", () => ({
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

function openModal(workspace: object | null, isPermanent = false) {
  const store = createStore();
  store.set(
    currentUserAtom,
    workspace ? ({ user: {}, workspace } as any) : null,
  );

  const { result } = renderHook(() => useDeletePageModal(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
  result.current.openDeleteModal({ onConfirm: vi.fn(), isPermanent });

  const { children } = mocks.openConfirmModal.mock.calls.at(-1)[0];
  return render(children as ReactElement).container.textContent;
}

afterEach(() => {
  mocks.openConfirmModal.mockReset();
});

describe("useDeletePageModal", () => {
  it("states the workspace trash retention when moving a page to trash", () => {
    expect(openModal({ trashRetentionDays: 7 })).toBe(
      "Pages in trash are permanently deleted after 7 days.",
    );
  });

  it("falls back to 30 days when the workspace has no retention set", () => {
    expect(openModal(null)).toBe(
      "Pages in trash are permanently deleted after 30 days.",
    );
  });

  it("warns about permanent deletion without the retention period", () => {
    expect(openModal({ trashRetentionDays: 7 }, true)).toContain(
      "This action is irreversible.",
    );
  });
});
