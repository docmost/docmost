import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { type ReactNode, useLayoutEffect } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAIN_CONTENT_ID } from "@/components/ui/skip-to-main";
import AnnouncementBanners from "./announcement-banners";
import classes from "./announcement-banners.module.css";
import {
  ANNOUNCEMENT_BANNERS_HEIGHT_VAR,
  ANNOUNCEMENT_COLOR_STYLES,
} from "../announcement.constants";
import { dismissAnnouncement } from "../announcement.utils";
import type {
  AnnouncementColor,
  AnnouncementType,
  IAnnouncementBanner,
} from "../types/announcement.types";

const mocks = vi.hoisted(() => ({
  banners: [] as IAnnouncementBanner[],
}));

vi.mock("@/ee/announcement/queries/announcement-query", () => ({
  useVisibleAnnouncementsQuery: () => ({ data: mocks.banners }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let barHeight: number;
let rootMeasurements: number;
let resizeObservers: ResizeObserverStub[];

class ResizeObserverStub {
  private connected = true;

  constructor(private callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {
    this.connected = false;
  }

  resize() {
    if (this.connected) {
      this.callback([], this as unknown as ResizeObserver);
    }
  }
}

// The banner root measures as tall as the bars it holds
function measureBannerRoot(this: Element): DOMRect {
  const isRoot = this.classList.contains(classes.root);
  if (isRoot) {
    rootMeasurements++;
  }
  const height = isRoot ? this.children.length * barHeight : 0;
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: height,
    width: 0,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

const banner = (
  id: string,
  text: string,
  overrides: Partial<IAnnouncementBanner> = {},
): IAnnouncementBanner => ({
  id,
  type: "info",
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

const publishedHeight = () =>
  document.documentElement.style.getPropertyValue(
    ANNOUNCEMENT_BANNERS_HEIGHT_VAR,
  );

const resizeBanners = () =>
  act(() => resizeObservers.forEach((observer) => observer.resize()));

function bannersTree(
  onHeightChange?: (height: number) => void,
  sibling?: ReactNode,
) {
  return (
    <MantineProvider>
      <MemoryRouter>
        <AnnouncementBanners surface="app" onHeightChange={onHeightChange} />
        {sibling}
      </MemoryRouter>
    </MantineProvider>
  );
}

function renderBanners(
  onHeightChange?: (height: number) => void,
  sibling?: ReactNode,
) {
  return render(bannersTree(onHeightChange, sibling));
}

beforeEach(() => {
  mocks.banners = [];
  barHeight = 36;
  rootMeasurements = 0;
  resizeObservers = [];
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
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    measureBannerRoot,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("falls back to the gray preset and no icon for an unknown color and type", () => {
    mocks.banners = [
      banner("unknown-1", "From a newer server", {
        type: "sparkle" as AnnouncementType,
        color: "teal" as AnnouncementColor,
        isDismissible: false,
      }),
    ];

    renderBanners();

    const bar = screen
      .getByText("From a newer server")
      .closest<HTMLElement>("[style]");
    const gray = document.createElement("div");
    gray.style.backgroundColor = ANNOUNCEMENT_COLOR_STYLES.gray.background;
    gray.style.color = ANNOUNCEMENT_COLOR_STYLES.gray.text;
    expect(bar?.style.backgroundColor).toBe(gray.style.backgroundColor);
    expect(bar?.style.color).toBe(gray.style.color);
    expect(bar?.querySelector("svg")).toBeNull();
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

  it("publishes its height before the first paint", () => {
    mocks.banners = [banner("paint-1", "First"), banner("paint-2", "Second")];
    const onHeightChange = vi.fn();
    const seenBeforePaint: Array<[string, number[]]> = [];
    function LayoutProbe() {
      useLayoutEffect(() => {
        seenBeforePaint.push([
          publishedHeight(),
          onHeightChange.mock.calls.map(([height]) => height),
        ]);
      });
      return null;
    }

    renderBanners(onHeightChange, <LayoutProbe />);

    expect(seenBeforePaint[0]).toEqual(["72px", [72]]);
  });

  it("publishes the new height as soon as a banner is dismissed", () => {
    mocks.banners = [banner("shrink-1", "First"), banner("shrink-2", "Second")];
    const onHeightChange = vi.fn();
    renderBanners(onHeightChange);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Dismiss announcement" })[0],
    );

    expect(publishedHeight()).toBe("36px");
    expect(onHeightChange.mock.calls).toEqual([[72], [36]]);
  });

  it("measures only when the banners change and reports each height once", () => {
    mocks.banners = [banner("guard-1", "First")];
    const onHeightChange = vi.fn();
    const { rerender } = renderBanners(onHeightChange);
    const measuredOnMount = rootMeasurements;
    expect(measuredOnMount).toBeGreaterThan(0);

    // the app shell re-renders on every mouse move while the sidebar is resized
    rerender(bannersTree(onHeightChange));
    rerender(bannersTree(onHeightChange));
    expect(rootMeasurements).toBe(measuredOnMount);

    resizeBanners();
    expect(rootMeasurements).toBe(measuredOnMount + 1);
    expect(onHeightChange.mock.calls).toEqual([[36]]);
  });

  it("publishes a new height when a resize makes the banners wrap", () => {
    mocks.banners = [banner("wrap-1", "A message that wraps on narrow windows")];
    const onHeightChange = vi.fn();
    renderBanners(onHeightChange);

    barHeight = 56;
    resizeBanners();

    expect(publishedHeight()).toBe("56px");
    expect(onHeightChange.mock.calls).toEqual([[36], [56]]);
  });

  it("keeps the real height when it remounts with cached banners", async () => {
    mocks.banners = [banner("cached-1", "First"), banner("cached-2", "Second")];
    const onHeightChange = vi.fn();
    renderBanners(onHeightChange).unmount();
    onHeightChange.mockClear();

    renderBanners(onHeightChange);
    // leave time for anything that would publish later, after paint
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(onHeightChange.mock.calls).toEqual([[72]]);
    expect(publishedHeight()).toBe("72px");
  });

  it("publishes its height and clears it on unmount", () => {
    mocks.banners = [banner("height-1", "First"), banner("height-2", "Second")];
    const onHeightChange = vi.fn();

    const { unmount } = renderBanners(onHeightChange);
    expect(publishedHeight()).toBe("72px");
    expect(onHeightChange).toHaveBeenLastCalledWith(72);

    unmount();
    expect(publishedHeight()).toBe("");
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });

  it("keeps the height of banners that replace others in the same commit", () => {
    mocks.banners = [banner("swap-1", "First"), banner("swap-2", "Second")];
    const layout = (surface: "app" | "public") => (
      <MantineProvider>
        <MemoryRouter>
          <AnnouncementBanners key={surface} surface={surface} />
        </MemoryRouter>
      </MantineProvider>
    );
    const { rerender } = render(layout("app"));

    rerender(layout("public"));

    expect(publishedHeight()).toBe("72px");
  });

  it("hands focus to the next close button, then to the main content, as banners are dismissed", () => {
    mocks.banners = [banner("focus-1", "First"), banner("focus-2", "Second")];
    renderBanners(undefined, <main id={MAIN_CONTENT_ID} tabIndex={-1} />);
    const [first, second] = screen.getAllByRole("button", {
      name: "Dismiss announcement",
    });

    first.focus();
    fireEvent.click(first);
    expect(document.activeElement).toBe(second);

    fireEvent.click(second);
    expect(document.activeElement).toBe(
      document.getElementById(MAIN_CONTENT_ID),
    );
  });
});
