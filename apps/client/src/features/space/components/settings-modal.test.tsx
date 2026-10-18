import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import SpaceSettingsModal from "./settings-modal";

vi.mock("@/features/space/queries/space-query.ts", () => ({
  useSpaceQuery: vi.fn(),
}));
vi.mock("@/features/space/components/space-members.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/space/components/add-space-members-modal.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/space/components/space-details.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/public-space/components/publish-space-settings.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/public-space/utils/public-space-access.ts", () => ({
  isPublicSpacesAllowed: () => false,
}));
// The real component renders nothing when it is read-only; the modal decides that.
vi.mock("@/features/space/components/space-security-settings.tsx", () => ({
  default: ({ readOnly }: { readOnly?: boolean }) =>
    readOnly ? null : <div data-testid="security-settings" />,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const admin = [{ action: "manage", subject: "settings" }];
const writer = [{ action: "read", subject: "settings" }];

function renderModal(permissions: unknown[]) {
  vi.mocked(useSpaceQuery).mockReturnValue({
    data: { id: "space-1", name: "Quality", membership: { permissions } },
  } as unknown as ReturnType<typeof useSpaceQuery>);

  render(
    <MantineProvider>
      <SpaceSettingsModal spaceId="space-1" opened onClose={() => undefined} />
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
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

describe("SpaceSettingsModal security tab", () => {
  it("is offered to a space admin, who gets the security settings with it", async () => {
    renderModal(admin);

    fireEvent.click(await screen.findByRole("tab", { name: "Security" }));

    expect(await screen.findByTestId("security-settings")).toBeTruthy();
  });

  it("is not offered to a member who may not manage the space settings", async () => {
    renderModal(writer);

    expect(await screen.findByRole("tab", { name: "Members" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Security" })).toBeNull();
    expect(screen.queryByTestId("security-settings")).toBeNull();
  });
});
