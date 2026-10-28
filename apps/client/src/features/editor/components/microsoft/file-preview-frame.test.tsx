import { MantineProvider } from "@mantine/core";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilePreviewFrame } from "./file-preview-frame";

const mocks = vi.hoisted(() => ({
  useM365Preview: vi.fn(),
  useM365Item: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
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

function renderFrame(fill = false) {
  render(
    <MantineProvider env="test">
      <FilePreviewFrame item={item} fill={fill} />
    </MantineProvider>,
  );
}

describe("FilePreviewFrame visibility observer", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    mocks.useM365Preview.mockReturnValue({ state: "loading" });
    mocks.useM365Item.mockReturnValue({ state: "loading" });
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
