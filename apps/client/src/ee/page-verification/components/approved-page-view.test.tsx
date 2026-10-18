import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { createStore, PrimitiveAtom, Provider } from "jotai";
import type { Editor } from "@tiptap/core";
import {
  pageEditorAtom,
  readOnlyEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { ApprovedPageView } from "./approved-page-view";

const { editor, mounts, readerProps } = vi.hoisted(() => ({
  editor: { isDestroyed: false } as unknown as Editor,
  mounts: { count: 0 },
  readerProps: { current: undefined as Record<string, unknown> | undefined },
}));

vi.mock("@/features/editor/readonly-page-editor", async () => {
  const { useEffect } = await import("react");
  const { useSetAtom } = await import("jotai");
  const atoms = await import("@/features/editor/atoms/editor-atoms");
  return {
    default: function ReadonlyPageEditorStub(props: Record<string, unknown>) {
      const setReadOnlyEditor = useSetAtom(
        atoms.readOnlyEditorAtom as PrimitiveAtom<Editor | null>,
      );
      readerProps.current = props;
      useEffect(() => {
        mounts.count += 1;
        setReadOnlyEditor(editor);
      }, []);
      return <div data-testid="reader">{props.title as string}</div>;
    },
  };
});

vi.mock("@/features/editor/full-editor", () => ({
  PageByline: () => null,
}));
vi.mock(
  "@/features/editor/components/search-and-replace/search-and-replace-dialog",
  () => ({ default: () => null }),
);
vi.mock(
  "@/features/editor/components/search-and-replace/search-navigation-dialog",
  () => ({ default: () => null }),
);
vi.mock("@/features/page/trash/components/deleted-page-banner", () => ({
  DeletedPageBanner: () => null,
}));

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const view = (updatedAt: string) => (
  <ApprovedPageView
    pageId="page-1"
    slugId="slug-1"
    title="Approved title"
    content={{ type: "doc", content: [] }}
    updatedAt={new Date(updatedAt)}
  />
);

function renderView(updatedAt = "2026-10-18T10:00:00Z") {
  const store = createStore();
  const wrap = (node: ReactNode) => (
    <Provider store={store}>
      <MantineProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </MantineProvider>
    </Provider>
  );
  const utils = render(wrap(view(updatedAt)));
  return {
    store,
    unmount: utils.unmount,
    rerender: (next: string) => utils.rerender(wrap(view(next))),
  };
}

describe("ApprovedPageView", () => {
  it("shows the approved title through the read-only editor", () => {
    const { unmount } = renderView();

    expect(readerProps.current).toMatchObject({
      title: "Approved title",
      pageId: "page-1",
      lightbox: true,
    });
    unmount();
  });

  it("lends its editor to the page editor atom while mounted", () => {
    const { store, unmount } = renderView();

    expect(store.get(pageEditorAtom)).toBe(editor);
    expect(store.get(readOnlyEditorAtom)).toBe(editor);

    unmount();
    expect(store.get(pageEditorAtom)).toBeNull();
  });

  it("remounts the editor when a new version is approved", () => {
    mounts.count = 0;
    const { rerender, unmount } = renderView("2026-10-18T10:00:00Z");
    expect(mounts.count).toBe(1);

    rerender("2026-10-18T10:00:00Z");
    expect(mounts.count).toBe(1);

    rerender("2026-10-18T11:00:00Z");
    expect(mounts.count).toBe(2);
    unmount();
  });
});
