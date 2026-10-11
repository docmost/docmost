import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import PlantumlView from "./plantuml-view";

// <img>-rendering branch that carried the bug.
vi.mock("@/lib/config", () => ({
  getPlantumlUrl: () => "https://plantuml.example.com",
  getPlantumlFormat: () => "svg",
}));

// buildPlantumlImageUrl is async (Compression Streams API under the hood).
// Never resolving it simulates the window between mount and URL resolution,
// where `imageUrl` is still null and (pre-fix) an <img src=""> is rendered.
vi.mock("@docmost/editor-ext", () => ({
  buildPlantumlImageUrl: () => new Promise<string>(() => {}),
}));

function makeProps(source: string): NodeViewProps {
  return {
    node: { textContent: source } as any,
    editor: { isEditable: true } as any,
  } as unknown as NodeViewProps;
}

describe("PlantumlView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows no error before the server image URL resolves, even if the empty-src <img> fires onError", async () => {
    const { container } = render(<PlantumlView props={makeProps("A -> B")} />);

    // Let the debounce timer (500ms) elapse so the URL-building effect
    // starts, but buildPlantumlImageUrl never resolves, so imageUrl stays
    // null throughout this test.
    await vi.advanceTimersByTimeAsync(600);

    // jsdom does not spontaneously fire `error` for an empty `src` the way
    // real browsers do, so simulate the real-browser race explicitly: an
    // <img src=""> immediately faults and its onError handler runs before
    // the async URL ever resolves. Only fire it if the buggy <img> was
    // actually rendered — the fix's early return means no <img> exists.
    const img = container.querySelector("img");
    if (img) {
      fireEvent.error(img);
    }

    expect(container.textContent).not.toContain(
      "PlantUML diagram error: could not reach the PlantUML server",
    );
    expect(container.querySelector(".error, [class*='error']")).toBeNull();
  });
});
