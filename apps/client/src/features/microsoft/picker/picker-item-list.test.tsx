import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { M365Item } from "@/features/microsoft/types/microsoft.types";
import { PickerItemList } from "./picker-item-list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

// The real helper throws on an invalid date, so this does too
vi.mock("@/lib/time", () => ({
  timeAgo: (date: Date) => {
    if (Number.isNaN(date.getTime())) throw new RangeError("Invalid time value");
    return "3 days ago";
  },
}));

function file(name: string, extra: Partial<M365Item> = {}): M365Item {
  return {
    kind: "file",
    driveId: "drive-1",
    itemId: `file-${name}`,
    name,
    webUrl: `https://contoso.sharepoint.com/sites/team/${name}`,
    ...extra,
  };
}

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

function renderList(items: M365Item[]) {
  render(
    <MantineProvider>
      <PickerItemList
        items={items}
        loading={false}
        selectedKeys={new Set()}
        emptyLabel="No files found"
        onToggle={vi.fn()}
        onOpenFolder={vi.fn()}
      />
    </MantineProvider>,
  );
}

const optionText = (name: string) =>
  screen.getByText(name).closest('[role="option"]')?.textContent;

describe("PickerItemList", () => {
  beforeEach(setMediaMatch);
  afterEach(cleanup);

  it("leaves out a modified date that does not parse", () => {
    renderList([
      file("garbled.docx", {
        lastModifiedDateTime: "not a date",
        lastModifiedBy: "Bob",
      }),
      file("dated.docx", {
        lastModifiedDateTime: "2026-10-03T09:00:00Z",
        lastModifiedBy: "Ann",
      }),
    ]);

    expect(optionText("garbled.docx")).toBe("garbled.docxBob");
    expect(optionText("dated.docx")).toBe("dated.docxAnn • 3 days ago");
  });
});
