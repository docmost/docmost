import { MantineProvider } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementContent } from "./announcement-content";
import type {
  IAnnouncementContent,
  IAnnouncementText,
} from "../types/announcement.types";

const doc = (...nodes: IAnnouncementText[]): IAnnouncementContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: nodes }],
});
const renderContent = (c: IAnnouncementContent) =>
  render(
    <MantineProvider env="test">
      <MemoryRouter>
        <AnnouncementContent content={c} />
      </MemoryRouter>
    </MantineProvider>,
  );

// The client router cancels the browser navigation of the links it handles
function isRoutedInApp(link: HTMLElement): boolean {
  let routed = false;
  document.addEventListener(
    "click",
    (event) => {
      routed = event.defaultPrevented;
      // jsdom cannot navigate
      event.preventDefault();
    },
    { once: true },
  );
  fireEvent.click(link);
  return routed;
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnnouncementContent", () => {
  it("renders bold, italic and underline", () => {
    const { container } = renderContent(
      doc({
        type: "text",
        text: "All",
        marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }],
      }),
    );
    expect(container.querySelector("strong")?.textContent).toBe("All");
    expect(container.querySelector("em")?.textContent).toBe("All");
    expect(container.querySelector("u")?.textContent).toBe("All");
  });

  it("opens external links in a new tab", () => {
    renderContent(
      doc({
        type: "text",
        text: "Status",
        marks: [{ type: "link", attrs: { href: "https://status.test" } }],
      }),
    );
    const link = screen.getByRole("link", {
      name: "Status (opens in a new tab)",
    });
    expect(link.getAttribute("href")).toBe("https://status.test");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("keeps internal links in the same tab", () => {
    renderContent(
      doc({
        type: "text",
        text: "Policy",
        marks: [{ type: "link", attrs: { href: "/s/general/p/policy-abc" } }],
      }),
    );
    const link = screen.getByRole("link", { name: "Policy" });
    expect(link.getAttribute("href")).toBe("/s/general/p/policy-abc");
    expect(link.hasAttribute("target")).toBe(false);
    expect(isRoutedInApp(link)).toBe(true);
  });

  it("leaves server paths such as file links to the browser, in the same tab", () => {
    renderContent(
      doc({
        type: "text",
        text: "Handbook",
        marks: [
          {
            type: "link",
            attrs: { href: "/api/files/019a4f7e-handbook/handbook.pdf" },
          },
        ],
      }),
    );
    const link = screen.getByRole("link", { name: "Handbook" });
    expect(link.getAttribute("href")).toBe(
      "/api/files/019a4f7e-handbook/handbook.pdf",
    );
    expect(link.hasAttribute("target")).toBe(false);
    expect(isRoutedInApp(link)).toBe(false);
  });

  it("drops unsafe links but keeps their text", () => {
    renderContent(
      doc({
        type: "text",
        text: "Click",
        marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
      }),
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Click")).toBeTruthy();
  });
});
