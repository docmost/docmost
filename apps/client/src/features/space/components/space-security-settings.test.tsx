import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import type { ISpace } from "@/features/space/types/space.types";
import SpaceSecuritySettings from "./space-security-settings";

vi.mock("@/ee/security/components/space-public-sharing-toggle.tsx", () => ({
  default: () => <div data-testid="sharing" />,
}));
vi.mock("@/ee/security/components/space-viewer-comments-toggle.tsx", () => ({
  default: () => <div data-testid="comments" />,
}));
vi.mock("@/ee/page-verification/components/space-approval-settings.tsx", () => ({
  default: () => <div data-testid="approval" />,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const space = { id: "space-1" } as ISpace;

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

describe("SpaceSecuritySettings", () => {
  it("puts the approval settings next to the other security settings for a space admin", () => {
    render(
      <MantineProvider>
        <SpaceSecuritySettings space={space} />
      </MantineProvider>,
    );

    expect(screen.getByRole("heading", { name: "Security" })).toBeTruthy();
    expect(screen.getByTestId("sharing")).toBeTruthy();
    expect(screen.getByTestId("comments")).toBeTruthy();
    expect(screen.getByTestId("approval")).toBeTruthy();
  });

  it("mounts nothing for anyone who may not manage the space settings", () => {
    render(
      <MantineProvider>
        <SpaceSecuritySettings space={space} readOnly />
      </MantineProvider>,
    );

    expect(screen.queryByTestId("approval")).toBeNull();
    expect(screen.queryByTestId("sharing")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Security" })).toBeNull();
  });
});
