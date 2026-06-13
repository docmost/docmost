import { afterEach, beforeAll, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const mutate = vi.fn();
vi.mock("@/ee/base/queries/base-query", () => ({
  useConvertPageToBaseMutation: () => ({ mutate, isPending: false }),
}));

vi.mock("@/ee/hooks/use-feature", () => ({
  useHasFeature: () => true,
}));

// A stub TipTap editor reporting an empty document, with no-op event wiring.
const editorStub = {
  isEmpty: true,
  on: () => {},
  off: () => {},
};
let editorValue: typeof editorStub | null = editorStub;
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return { ...actual, useAtomValue: () => editorValue };
});

import { EmptyPageGetStarted } from "../empty-page-get-started";

afterEach(() => {
  cleanup();
  mutate.mockReset();
  editorValue = editorStub;
});

function renderBar(editable = true) {
  return render(
    <MantineProvider>
      <EmptyPageGetStarted pageId="p1" editable={editable} />
    </MantineProvider>,
  );
}

describe("EmptyPageGetStarted", () => {
  it("renders the Get started label and a Base chip when empty + editable", () => {
    renderBar();
    expect(screen.getByText("Get started with")).toBeTruthy();
    expect(screen.getByText("Base")).toBeTruthy();
  });

  it("triggers the convert mutation with the pageId when Base is clicked", () => {
    renderBar();
    fireEvent.click(screen.getByText("Base"));
    expect(mutate).toHaveBeenCalledWith({ pageId: "p1" });
  });

  it("renders nothing when not editable", () => {
    renderBar(false);
    expect(screen.queryByText("Get started with")).toBeNull();
    expect(screen.queryByText("Base")).toBeNull();
  });

  it("renders nothing when there is no editor", () => {
    editorValue = null;
    renderBar();
    expect(screen.queryByText("Get started with")).toBeNull();
    expect(screen.queryByText("Base")).toBeNull();
  });
});
