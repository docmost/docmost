import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ISpace } from "@/features/space/types/space.types.ts";
import SpaceArchivedNotice from "./space-archived-notice";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (value: string, options?: { date?: string; name?: string }) =>
      value
        .replace("{{date}}", options?.date ?? "")
        .replace("{{name}}", options?.name ?? ""),
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/i18n.ts", () => ({
  default: { language: "en-US", t: (value: string) => value },
}));

vi.mock("@/features/space/queries/space-query.ts", () => ({
  useUnarchiveSpaceMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/space/permissions/use-space-ability.ts", () => ({
  useSpaceAbility: () => ({ can: () => false }),
}));

function setMediaMatch() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderNotice(archivedAt: Date, archivedBy: ISpace["archivedBy"] = null) {
  const space = { id: "space-1", slug: "docs", archivedAt, archivedBy } as ISpace;

  return render(
    <MantineProvider>
      <SpaceArchivedNotice space={space} />
    </MantineProvider>,
  );
}

describe("SpaceArchivedNotice", () => {
  beforeEach(() => {
    setMediaMatch();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 2, 18, 0));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the calendar date for a space archived today", () => {
    renderNotice(new Date(2026, 10, 2, 15, 45));

    const notice = screen.getByRole("note").textContent;

    expect(notice).toContain("This space is archived.");
    expect(notice).toContain("Archived on Nov 2, 2026.");
    expect(notice).not.toMatch(/today|yesterday/i);
  });

  it("names who archived the space", () => {
    renderNotice(new Date(2026, 10, 2, 15, 45), {
      id: "user-1",
      name: "Ada Lovelace",
      avatarUrl: "",
    });

    expect(screen.getByRole("note").textContent).toContain(
      "Archived by Ada Lovelace on Nov 2, 2026.",
    );
  });

  it("is a note, so it is not announced as an alert on every page", () => {
    renderNotice(new Date(2026, 10, 2, 15, 45));

    expect(screen.getByRole("note")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
