import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnnouncementBanners from "./announcement-banners";
import { ANNOUNCEMENT_BANNERS_HEIGHT_VAR } from "../announcement.constants";
import { dismissAnnouncement } from "../announcement.utils";
import type { IAnnouncementBanner } from "../types/announcement.types";

const mocks = vi.hoisted(() => ({
  banners: [] as IAnnouncementBanner[],
  observedHeight: 0,
}));

vi.mock("@/ee/announcement/queries/announcement-query", () => ({
  useVisibleAnnouncementsQuery: () => ({ data: mocks.banners }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

class ResizeObserverStub {
  constructor(private callback: ResizeObserverCallback) {}

  observe(target: Element) {
    if (!mocks.observedHeight) {
      return;
    }
    const entry = {
      target,
      borderBoxSize: [{ blockSize: mocks.observedHeight, inlineSize: 0 }],
      contentRect: { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0 },
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }

  unobserve() {}

  disconnect() {}
}

const banner = (
  id: string,
  text: string,
  overrides: Partial<IAnnouncementBanner> = {},
): IAnnouncementBanner => ({
  id,
  kind: "info",
  color: "blue",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  },
  isDismissible: true,
  startsAt: "2026-01-01T09:00:00.000Z",
  endsAt: null,
  ...overrides,
});

function renderBanners(onHeightChange?: (height: number) => void) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <AnnouncementBanners surface="app" onHeightChange={onHeightChange} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

beforeEach(() => {
  mocks.banners = [];
  mocks.observedHeight = 0;
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AnnouncementBanners", () => {
  it("hides a dismissed banner, also after a remount", () => {
    mocks.banners = [banner("dismiss-1", "Maintenance tonight")];
    const { unmount } = renderBanners();

    const region = screen.getByRole("region", { name: "Announcements" });
    expect(within(region).getByText("Maintenance tonight")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss announcement" }),
    );
    expect(screen.queryByText("Maintenance tonight")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();

    unmount();
    renderBanners();
    expect(screen.queryByText("Maintenance tonight")).toBeNull();
  });

  it("shows a banner that is no longer dismissible despite an earlier dismissal", () => {
    const announcement = banner("sticky-1", "Policy update", {
      isDismissible: false,
    });
    dismissAnnouncement(announcement);
    mocks.banners = [announcement];

    renderBanners();

    expect(screen.getByText("Policy update")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Dismiss announcement" }),
    ).toBeNull();
  });

  it("hides ended and shows started banners on the 30-second tick", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00.000Z"));
    mocks.banners = [
      banner("ending-1", "Ends soon", { endsAt: "2026-11-04T10:00:20.000Z" }),
      banner("starting-1", "Starts soon", {
        startsAt: "2026-11-04T10:00:20.000Z",
      }),
    ];

    renderBanners();
    expect(screen.getByText("Ends soon")).toBeTruthy();
    expect(screen.queryByText("Starts soon")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByText("Ends soon")).toBeNull();
    expect(screen.getByText("Starts soon")).toBeTruthy();
  });

  it("publishes its height and clears it on unmount", async () => {
    mocks.observedHeight = 72;
    mocks.banners = [banner("height-1", "First"), banner("height-2", "Second")];
    const onHeightChange = vi.fn();
    const root = document.documentElement;

    const { unmount } = renderBanners(onHeightChange);

    await waitFor(() =>
      expect(root.style.getPropertyValue(ANNOUNCEMENT_BANNERS_HEIGHT_VAR)).toBe(
        "72px",
      ),
    );
    expect(onHeightChange).toHaveBeenLastCalledWith(72);

    unmount();
    expect(root.style.getPropertyValue(ANNOUNCEMENT_BANNERS_HEIGHT_VAR)).toBe(
      "",
    );
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });
});
