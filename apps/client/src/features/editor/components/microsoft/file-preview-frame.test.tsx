import { MantineProvider } from "@mantine/core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilePreviewFrame } from "./file-preview-frame";

const mocks = vi.hoisted(() => ({
  useM365Preview: vi.fn(),
  useM365Item: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? "")),
  }),
}));

vi.mock("@/features/microsoft/queries/microsoft-query", () => ({
  useM365Preview: mocks.useM365Preview,
  useM365Item: mocks.useM365Item,
}));

vi.mock("./file-state-card", () => ({ FileStateCard: () => null }));

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(private callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  report(entry: Partial<IntersectionObserverEntry>) {
    this.callback([entry as IntersectionObserverEntry], this as never);
  }
}

const item = {
  driveId: "drive-1",
  itemId: "item-1",
  webUrl: "https://contoso.sharepoint.com/sites/M/Shared%20Documents/Plan.docx",
  name: "Plan.docx",
};

const fullyVisible = {
  isIntersecting: true,
  intersectionRect: { height: 600 } as DOMRectReadOnly,
  boundingClientRect: { height: 600 } as DOMRectReadOnly,
  rootBounds: { height: 800 } as DOMRectReadOnly,
};

function renderFrame(fill = false, onClose?: () => void, frameItem = item) {
  render(
    <MantineProvider env="test">
      <FilePreviewFrame item={frameItem} fill={fill} onClose={onClose} />
    </MantineProvider>,
  );
}

function stubBrowser() {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("FilePreviewFrame visibility observer", () => {
  beforeEach(() => {
    stubBrowser();
    mocks.useM365Preview.mockReturnValue({ state: "loading" });
    mocks.useM365Item.mockReturnValue({ state: "loading" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("stops observing once the preview has loaded", () => {
    renderFrame();
    const [observer] = FakeIntersectionObserver.instances;

    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.disconnect).not.toHaveBeenCalled();
    expect(mocks.useM365Preview).toHaveBeenLastCalledWith(
      "drive-1",
      "item-1",
      false,
    );

    act(() => observer.report(fullyVisible));

    expect(mocks.useM365Preview).toHaveBeenLastCalledWith(
      "drive-1",
      "item-1",
      true,
    );
    expect(observer.disconnect).toHaveBeenCalled();
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
  });

  it("does not observe a frame that loads straight away", () => {
    renderFrame(true);

    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(mocks.useM365Preview).toHaveBeenLastCalledWith(
      "drive-1",
      "item-1",
      true,
    );
  });
});

describe("FilePreviewFrame in a modal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubBrowser();
    mocks.useM365Preview.mockReturnValue({
      state: "loaded",
      data: {
        getUrl:
          "https://contoso.sharepoint.com/_layouts/15/embed.aspx?UniqueId=1",
      },
      refetch: vi.fn(),
    });
    mocks.useM365Item.mockReturnValue({ state: "loading" });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const viewer = () => screen.getByTitle("Plan.docx");
  const closeButton = () =>
    screen.getByRole("button", { name: "Close preview of Plan.docx" });
  // As when the viewer focuses itself: the frame takes focus and the window blurs
  const focusViewer = () => {
    act(() => viewer().focus());
    fireEvent.blur(window);
    act(() => vi.advanceTimersByTime(0));
  };

  it("names the app the file lives in", () => {
    renderFrame(true, vi.fn(), {
      ...item,
      webUrl:
        "https://contoso-my.sharepoint.com/personal/ann_contoso_com/Documents/Plan.docx",
    });

    expect(
      screen.getByRole("link", { name: "Edit Plan.docx in OneDrive" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open Plan.docx in OneDrive" }),
    ).toBeTruthy();
    cleanup();

    renderFrame(true, vi.fn());

    expect(
      screen.getByRole("link", { name: "Open Plan.docx in SharePoint" }),
    ).toBeTruthy();
  });

  it("closes from its own header", () => {
    const onClose = vi.fn();
    renderFrame(true, onClose);

    fireEvent.click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("takes focus back from a viewer that focuses itself while loading", () => {
    renderFrame(true, vi.fn());

    act(() => viewer().focus());
    fireEvent.blur(window);
    // Not inside the blur event, where browsers keep sending keys to the frame
    expect(document.activeElement).toBe(viewer());

    act(() => vi.advanceTimersByTime(0));
    expect(document.activeElement).toBe(closeButton());
  });

  it("lets the viewer keep focus from a second after it loads", () => {
    renderFrame(true, vi.fn());
    fireEvent.load(viewer());

    act(() => vi.advanceTimersByTime(900));
    focusViewer();
    expect(document.activeElement).toBe(closeButton());

    act(() => vi.advanceTimersByTime(200));
    focusViewer();
    expect(document.activeElement).toBe(viewer());
  });

  it("leaves focus alone in a frame on the page", () => {
    renderFrame(true);

    focusViewer();

    expect(document.activeElement).toBe(viewer());
    expect(
      screen.queryByRole("button", { name: "Close preview of Plan.docx" }),
    ).toBeNull();
  });
});
