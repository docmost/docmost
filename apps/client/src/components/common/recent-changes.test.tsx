import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, expect, it, vi } from "vitest";
import RecentChanges from "./recent-changes";

const space = { id: "space", slug: "finance", name: "Finance" };
const self = { id: "self", name: "Alex Morgan", avatarUrl: null };
const amara = { id: "amara", name: "Amara Chen", avatarUrl: null };
const pages = [
  { title: "Intro", lastUpdatedBy: self },
  { title: "Budget", isBase: true, lastUpdatedBy: amara },
  { title: "Archive", lastUpdatedBy: null },
].map((page) => ({
  id: page.title,
  slugId: page.title,
  space,
  updatedAt: "2026-11-18",
  ...page,
}));

vi.mock("@/features/page/queries/page-query.ts", () => ({
  useRecentChangesQuery: () => ({ data: { pages: [{ items: pages }] } }),
}));
vi.mock("@/features/user/atoms/current-user-atom", async () => ({
  userAtom: (await import("jotai")).atom({ id: "self" }),
}));
vi.mock("@/lib/time.ts", () => ({ formattedDate: (date: string) => date }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeAll(() => {
  window.matchMedia ??= (media) => ({
    media,
    matches: false,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

it.each([undefined, space.id])(
  "shows the last editor alongside the update date (spaceId=%s)",
  (spaceId) => {
    render(
      <MantineProvider env="test">
        <MemoryRouter>
          <RecentChanges spaceId={spaceId} />
        </MemoryRouter>
      </MantineProvider>,
    );

    const [mine, other, unattributed] = screen
      .getAllByRole("row")
      .map((row) => within(row).getAllByRole("cell").pop());
    expect(within(mine).getByText("You")).toBeTruthy();
    expect(within(mine).getByText("AM")).toBeTruthy();
    expect(within(other).getByText("Amara Chen")).toBeTruthy();
    expect(within(other).getByText("AC")).toBeTruthy();
    expect(within(other).getByText("2026-11-18")).toBeTruthy();
    expect(unattributed.textContent).toBe("2026-11-18");
  },
);
