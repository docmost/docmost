import { describe, expect, it, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { DocumentTitle } from "./document-title.tsx";

const renderTitle = (ui: React.ReactNode) =>
  render(<HelmetProvider>{ui}</HelmetProvider>);

describe("DocumentTitle", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>Docmost</title>";
  });

  it("appends the app name", () => {
    renderTitle(<DocumentTitle title="Home" />);
    expect(document.title).toBe("Home - Docmost");
  });

  it("omits the app name when asked", () => {
    renderTitle(<DocumentTitle title="My page" withAppName={false} />);
    expect(document.title).toBe("My page");
  });

  it("falls back to the app name without a title", () => {
    renderTitle(<DocumentTitle />);
    expect(document.title).toBe("Docmost");
  });

  it("never renders an empty title", () => {
    renderTitle(<DocumentTitle title="Spaces" />);
    const titles = Array.from(document.querySelectorAll("head > title"));
    expect(titles.every((node) => node.textContent !== "")).toBe(true);
  });

  it("renders extra head children", () => {
    renderTitle(
      <DocumentTitle title="Shared">
        <meta name="robots" content="noindex" />
      </DocumentTitle>,
    );
    expect(
      document.querySelector('head > meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex");
  });
});
