import { MantineProvider } from "@mantine/core";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HtmlBlockFrame } from "./html-block-frame";
import { HTML_BLOCK_MESSAGE_TYPE } from "../html-block.constants";

const frameFor = (html: string, height: number | "fill" | null) => (
  <MantineProvider env="test" defaultColorScheme="auto">
    <HtmlBlockFrame html={html} height={height} title="Opening hours" />
  </MantineProvider>
);

const frame = () => screen.getByTitle("Opening hours") as HTMLIFrameElement;

const postHeight = (height: number, source: Window | null) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: HTML_BLOCK_MESSAGE_TYPE, height },
      source,
    }),
  );

const twoAnimationFrames = () =>
  act(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

const stubSystemScheme = (scheme: "light" | "dark") =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: scheme === "dark" && query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );

beforeEach(() => {
  localStorage.clear();
  stubSystemScheme("light");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HtmlBlockFrame", () => {
  it("renders the block in a sandbox without same-origin access", () => {
    render(frameFor("<p>Mon to Fri</p>", null));

    expect(frame().tagName).toBe("IFRAME");
    expect(frame().getAttribute("sandbox")).toBe(
      "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox",
    );
    expect(frame().getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(frame().getAttribute("allow")).toBe("clipboard-write; fullscreen");
    expect(frame().getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(frame().getAttribute("title")).toBe("Opening hours");
    expect(frame().getAttribute("srcdoc")).toContain("<p>Mon to Fri</p>");
    expect(frame().getAttribute("srcdoc")).toContain(HTML_BLOCK_MESSAGE_TYPE);
  });

  it("renders a fixed height of 0 at the minimum height", () => {
    render(frameFor("<p>Hi</p>", 0));

    expect(frame().style.height).toBe("40px");
  });

  it("clamps fixed heights and fills its container", () => {
    const { rerender } = render(frameFor("<p>Hi</p>", -20));
    expect(frame().style.height).toBe("40px");

    rerender(frameFor("<p>Hi</p>", 480));
    expect(frame().style.height).toBe("480px");

    rerender(frameFor("<p>Hi</p>", 50000));
    expect(frame().style.height).toBe("12000px");

    rerender(frameFor("<p>Hi</p>", "fill"));
    expect(frame().style.height).toBe("100%");
  });

  it("fits to height messages from its own frame only", async () => {
    render(frameFor("<p>Hi</p>", null));
    expect(frame().style.height).toBe("160px");

    postHeight(999, window);
    await twoAnimationFrames();
    expect(frame().style.height).toBe("160px");

    postHeight(320, frame().contentWindow);
    await waitFor(() => expect(frame().style.height).toBe("320px"));

    postHeight(12, frame().contentWindow);
    await waitFor(() => expect(frame().style.height).toBe("40px"));
  });

  it("builds the first srcdoc in the dark scheme on a dark system", () => {
    stubSystemScheme("dark");
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["srcdoc"],
    });

    render(frameFor("<p>Hi</p>", null));

    expect(frame().getAttribute("srcdoc")).toContain("color-scheme: dark");
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
});
