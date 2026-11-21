import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfRenderPage from "./pdf-render-page";

const { searchWhenEditorRenders } = vi.hoisted(() => ({
  searchWhenEditorRenders: [] as string[],
}));

vi.mock("@/features/editor/readonly-page-editor", () => ({
  default: ({ title }: { title: string }) => {
    searchWhenEditorRenders.push(window.location.search);
    return <div data-testid="readonly-editor">{title}</div>;
  },
}));

const renderData = {
  pageId: "page-1",
  title: "Opening hours",
  content: { type: "doc", content: [] },
  htmlBlocks: {},
};

const fetchMock = vi.fn();

beforeEach(() => {
  searchWhenEditorRenders.length = 0;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ data: renderData }),
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("PdfRenderPage", () => {
  it("renders with the token read at mount after taking it out of the address bar", async () => {
    window.history.replaceState(null, "", "/pdf-render/page-1?token=abc");

    render(
      <MantineProvider env="test">
        <BrowserRouter>
          <Routes>
            <Route path="/pdf-render/:pageId" element={<PdfRenderPage />} />
          </Routes>
        </BrowserRouter>
      </MantineProvider>,
    );

    const editor = await screen.findByTestId("readonly-editor");
    expect(editor.textContent).toBe("Opening hours");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pdf-export/render");
    expect(JSON.parse(init.body)).toEqual({ pageId: "page-1", token: "abc" });
    expect([...new Set(searchWhenEditorRenders)]).toEqual([""]);
    expect(window.location.pathname).toBe("/pdf-render/page-1");
    expect(window.location.search).toBe("");
  });
});
