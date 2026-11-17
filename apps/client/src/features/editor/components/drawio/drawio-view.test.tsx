import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MantineProvider } from "@mantine/core";
import type { NodeViewProps } from "@tiptap/react";
import { uploadFile } from "@/features/page/services/page-service.ts";
import DrawioView from "./drawio-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// the real one starts loading locale files over HTTP
vi.mock("@/i18n.ts", () => ({ default: { t: (key: string) => key } }));

vi.mock("@/features/page/services/page-service.ts", () => ({
  uploadFile: vi.fn(),
}));

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10px" height="10px"><g/></svg>';
const exported = `data:image/svg+xml;base64,${btoa(svg)}`;

const onPage = { isEditable: true, storage: { pageId: "page-1" } };
const updateAttributes = vi.fn();

// stands in for the node view: saved attributes come back as the node's attrs
function Host({ editor }: { editor: object }) {
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const props = {
    node: { attrs },
    editor,
    selected: false,
    updateAttributes: (saved: Record<string, unknown>) => {
      updateAttributes(saved);
      setAttrs((current) => ({ ...current, ...saved }));
    },
  } as unknown as NodeViewProps;

  return (
    <MantineProvider env="test">
      <DrawioView {...props} />
    </MantineProvider>
  );
}

const openEditor = () =>
  fireEvent.click(screen.getByText("Double-click to edit Draw.io diagram"), {
    detail: 2,
  });

const diagramEditor = () => document.querySelector("iframe.diagrams-iframe");

// what the draw.io frame posts to the page
const fromDrawio = (message: object) =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(message),
        origin: "https://embed.diagrams.net",
      }),
    );
  });

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("a draw.io diagram that has not been saved yet", () => {
  it("opens its editor on a page", () => {
    render(<Host editor={onPage} />);

    openEditor();

    expect(diagramEditor()).not.toBeNull();
  });

  it("does not open its editor where there is no page to save to", () => {
    render(<Host editor={{ isEditable: true, storage: {} }} />);

    openEditor();

    expect(diagramEditor()).toBeNull();
  });

  it("saves over its own first save instead of making another attachment", async () => {
    vi.mocked(uploadFile).mockResolvedValue({
      id: "att-1",
      fileName: "diagram.drawio.svg",
      fileSize: 10,
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as Awaited<ReturnType<typeof uploadFile>>);
    render(<Host editor={onPage} />);
    openEditor();

    // two autosaves, the way react-drawio reports an export
    await fromDrawio({ event: "export", data: exported, message: {} });
    await waitFor(() =>
      expect(updateAttributes).toHaveBeenCalledWith({ attachmentId: "att-1" }),
    );
    await fromDrawio({ event: "export", data: exported, message: {} });
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));

    const [first, second] = vi.mocked(uploadFile).mock.calls;
    expect(first[2]).toBeUndefined();
    expect(second[2]).toBe("att-1");
  });
});
