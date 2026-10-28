import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileCarousel } from "./file-carousel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

vi.mock("./file-preview-frame", () => ({ FilePreviewFrame: () => null }));

const plan = {
  driveId: "drive-1",
  itemId: "item-1",
  webUrl: "https://contoso.sharepoint.com/sites/M/Shared%20Documents/Plan.docx",
  name: "Plan.docx",
};

const unnamed = {
  driveId: "drive-1",
  itemId: "item-2",
  webUrl:
    "https://contoso.sharepoint.com/sites/M/Shared%20Documents/Budget.xlsx",
  name: "",
};

describe("FileCarousel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(cleanup);

  it("names the dot of a file with no name by its link", () => {
    render(
      <MantineProvider env="test">
        <FileCarousel items={[plan, unnamed]} onFullscreen={vi.fn()} />
      </MantineProvider>,
    );

    expect(screen.getByRole("button", { name: "Plan.docx" })).toBeTruthy();
    expect(screen.getByRole("button", { name: unnamed.webUrl })).toBeTruthy();
  });
});
