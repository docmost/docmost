import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import type { IPage } from "@/features/page/types/page.types";
import Page from "./page";

const { fullEditorProps } = vi.hoisted(() => ({
  fullEditorProps: { current: undefined as Record<string, unknown> | undefined },
}));

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: vi.fn(),
}));

vi.mock("@/features/editor/full-editor", () => ({
  FullEditor: (props: Record<string, unknown>) => {
    fullEditorProps.current = props;
    return <div data-testid="full-editor" />;
  },
}));

vi.mock("@/ee/page-verification/components/approved-page-view", () => ({
  ApprovedPageView: () => <div data-testid="approved-page-view" />,
}));

vi.mock("@/features/editor/title-editor", () => ({
  TitleEditor: () => null,
}));
vi.mock("@/features/page-history/components/history-modal", () => ({
  default: () => null,
}));
vi.mock("@/features/page/components/header/page-header.tsx", () => ({
  default: () => <div data-testid="page-header" />,
}));
vi.mock("@/features/space/queries/space-query.ts", () => ({
  useGetSpaceBySlugQuery: () => ({ data: { id: "space-1", settings: {} } }),
}));
vi.mock("@/features/comment/hooks/use-comment-deep-link", () => ({
  useCommentDeepLink: () => undefined,
}));
vi.mock("@/ee/base/components/base-view", () => ({ BaseView: () => null }));
vi.mock("@/ee/hooks/use-feature", () => ({ useHasFeature: () => false }));
vi.mock("@/components/ui/document-title.tsx", () => ({
  DocumentTitle: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const page = (overrides: Partial<IPage> = {}) =>
  ({
    id: "page-1",
    slugId: "slug-1",
    title: "Title",
    content: { type: "doc", content: [] },
    icon: "",
    spaceId: "space-1",
    space: { slug: "space" },
    isBase: false,
    deletedAt: null,
    updatedAt: new Date("2026-10-18T10:00:00Z"),
    contributors: [],
    permissions: { canEdit: true, hasRestriction: false },
    ...overrides,
  }) as unknown as IPage;

function renderPage(data: IPage) {
  vi.mocked(usePageQuery).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof usePageQuery>);

  render(
    <MantineProvider>
      <MemoryRouter initialEntries={["/s/space/p/title-slug-1"]}>
        <Routes>
          <Route path="/s/:spaceSlug/p/:pageSlug" element={<Page />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

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

beforeEach(() => {
  fullEditorProps.current = undefined;
});

afterEach(cleanup);

describe("page route", () => {
  it("shows the approved view and never the collab editor to a reader of a controlled page", () => {
    renderPage(
      page({
        approval: { controlled: true, canAccessDraft: false, unpublished: false },
      }),
    );

    expect(screen.getByTestId("approved-page-view")).toBeTruthy();
    expect(screen.queryByTestId("full-editor")).toBeNull();
    expect(fullEditorProps.current).toBeUndefined();
  });

  it("keeps the collab editor for a user with draft access", () => {
    renderPage(
      page({
        approval: { controlled: true, canAccessDraft: true, unpublished: false },
      }),
    );

    expect(screen.getByTestId("full-editor")).toBeTruthy();
    expect(screen.queryByTestId("approved-page-view")).toBeNull();
    expect(fullEditorProps.current).toMatchObject({ editable: true });
  });

  it("pauses editing while the page is locked for review", () => {
    renderPage(
      page({
        approval: {
          controlled: true,
          canAccessDraft: true,
          locked: true,
          unpublished: false,
        },
      }),
    );

    expect(screen.getByTestId("full-editor")).toBeTruthy();
    expect(fullEditorProps.current).toMatchObject({ editable: false });
  });

  it("renders a page without approval info in the editor as before", () => {
    renderPage(page());

    expect(screen.getByTestId("full-editor")).toBeTruthy();
    expect(screen.queryByTestId("approved-page-view")).toBeNull();
    expect(fullEditorProps.current).toMatchObject({
      editable: true,
      pageId: "page-1",
    });
  });

  it("keeps a page the user cannot edit read-only", () => {
    renderPage(
      page({ permissions: { canEdit: false, hasRestriction: false } }),
    );

    expect(fullEditorProps.current).toMatchObject({ editable: false });
  });
});
