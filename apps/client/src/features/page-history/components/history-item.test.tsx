import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { IPageHistory } from "@/features/page-history/types/page.types";
import HistoryItem from "./history-item";

vi.mock("@/lib/time", () => ({
  formattedDate: () => "Oct 18, 2026, 10:05AM",
}));
vi.mock("@/components/ui/custom-avatar.tsx", () => ({
  CustomAvatar: () => null,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

const item = (overrides: Partial<IPageHistory>): IPageHistory =>
  ({
    id: "h-1",
    createdAt: "2026-10-18T10:05:00Z",
    kind: null,
    version: null,
    changeSummary: null,
    approvedBy: null,
    lastUpdatedBy: { id: "u-1", name: "Ada", avatarUrl: "" },
    ...overrides,
  }) as IPageHistory;

function renderItem(historyItem: IPageHistory, compareMode: boolean) {
  render(
    <MantineProvider>
      <HistoryItem
        historyItem={historyItem}
        index={0}
        onSelect={() => undefined}
        isActive={false}
        compareMode={compareMode}
        isChecked={false}
        isCheckboxDisabled={false}
        canCompare
        onToggleCompare={() => undefined}
        onStartCompare={() => undefined}
      />
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

afterEach(cleanup);

describe("HistoryItem accessible names", () => {
  it("tells rows saved in the same minute apart by their kind", () => {
    renderItem(item({ kind: "baseline" }), false);
    const baseline = screen
      .getByRole("button", { name: /^Actions for/ })
      .getAttribute("aria-label");
    cleanup();

    renderItem(
      item({
        kind: "approved",
        version: 3,
        approvedBy: { id: "u-2", name: "Grace", avatarUrl: "" },
      }),
      false,
    );
    const approved = screen
      .getByRole("button", { name: /^Actions for/ })
      .getAttribute("aria-label");

    expect(baseline).toBe("Actions for Baseline from Oct 18, 2026, 10:05AM");
    expect(approved).toBe(
      "Actions for Version 3 · Approved by Grace from Oct 18, 2026, 10:05AM",
    );
  });

  it("names the compare checkbox after the kind as well", () => {
    renderItem(item({ kind: "draft", changeSummary: "Updated torque" }), true);

    expect(
      screen.getByRole("checkbox", {
        name: "Select Submitted for approval from Oct 18, 2026, 10:05AM",
      }),
    ).toBeTruthy();
  });

  it("keeps the date-only names for rows without a kind", () => {
    renderItem(item({}), true);

    expect(
      screen.getByRole("checkbox", {
        name: "Select version from Oct 18, 2026, 10:05AM",
      }),
    ).toBeTruthy();

    cleanup();
    renderItem(item({}), false);

    expect(
      screen.getByRole("button", {
        name: "Version actions for Oct 18, 2026, 10:05AM",
      }),
    ).toBeTruthy();
  });
});
