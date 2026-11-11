import { MantineProvider, Modal } from "@mantine/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementMessageEditor } from "./announcement-message-editor";
import type {
  IAnnouncementContent,
  IAnnouncementText,
} from "../types/announcement.types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
// emoji-mart renders a web component jsdom cannot drive
vi.mock("@/components/ui/emoji-picker.tsx", () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (emoji: { native: string }) => void }) => (
    <button type="button" aria-label="Pick emoji" onClick={() => onEmojiSelect({ native: "🎉" })} />
  ),
}));

const doc = (...nodes: IAnnouncementText[]): IAnnouncementContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: nodes }],
});

function renderEditor(initialContent: IAnnouncementContent | null = null) {
  const onChange = vi.fn();
  render(
    <MantineProvider env="test">
      <AnnouncementMessageEditor initialContent={initialContent} onChange={onChange} />
    </MantineProvider>,
  );
  return { onChange };
}

function lastContent(onChange: ReturnType<typeof vi.fn>): IAnnouncementContent {
  return onChange.mock.calls[onChange.mock.calls.length - 1][0];
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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

describe("AnnouncementMessageEditor", () => {
  it("labels the editable area with the field label", () => {
    renderEditor();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeTruthy();
  });

  it.each([
    [399, null],
    [450, "450/500"],
  ])("shows the counter only from 400 characters (%i)", (length, counter) => {
    renderEditor(doc({ type: "text", text: "a".repeat(length) }));
    expect(screen.queryByText(/\/500$/)?.textContent ?? null).toBe(counter);
  });

  it("turns the counter red above 500 characters", () => {
    renderEditor(doc({ type: "text", text: "a".repeat(501) }));
    expect(screen.getByText("501/500").style.color).toContain("red");
  });

  it("groups the format buttons in a labelled toolbar", () => {
    renderEditor();
    const toolbar = screen.getByRole("toolbar", { name: "Editor toolbar" });
    expect(
      within(toolbar).getAllByRole("button").map((button) => button.ariaLabel),
    ).toEqual(["Bold", "Italic", "Underline", "Link", "Pick emoji"]);
  });

  it("adds the picked emoji to the message", () => {
    const { onChange } = renderEditor(doc({ type: "text", text: "Hello" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick emoji" }));
    const text = lastContent(onChange)
      .content[0].content.map((node) => node.text)
      .join("");
    expect(text).toContain("🎉");
    expect(text).toContain("Hello");
  });

  it("reports the pressed state of a format button", () => {
    renderEditor(doc({ type: "text", text: "Hello" }));
    const bold = screen.getByRole("button", { name: "Bold" });
    expect(bold.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(bold);

    expect(bold.getAttribute("aria-pressed")).toBe("true");
  });

  it("marks the link button as a popover trigger that reports when it is open", () => {
    renderEditor();
    const link = screen.getByRole("button", { name: "Link" });
    expect(link.getAttribute("aria-haspopup")).toBe("dialog");
    expect(link.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(link);

    expect(link.getAttribute("aria-expanded")).toBe("true");
  });

  it("rejects an unsafe link and inserts a safe one", () => {
    const { onChange } = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const url = screen.getByRole("textbox", { name: "URL" });

    fireEvent.change(url, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("Enter a link starting with https://, http://, mailto: or /"),
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(url, { target: { value: "https://status.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const [node] = lastContent(onChange).content[0].content;
    expect(node.text).toBe("https://status.example.com");
    expect(node.marks?.[0]).toMatchObject({
      type: "link",
      attrs: { href: "https://status.example.com" },
    });
    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();
  });

  it("removes the link at the cursor", () => {
    const { onChange } = renderEditor(
      doc({
        type: "text",
        text: "Status",
        marks: [{ type: "link", attrs: { href: "https://status.example.com" } }],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    expect(
      (screen.getByRole("textbox", { name: "URL" }) as HTMLInputElement).value,
    ).toBe("https://status.example.com");

    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));

    expect(lastContent(onChange).content[0].content).toEqual([
      { type: "text", text: "Status" },
    ]);
  });

  it("keeps the link form's submit away from a surrounding form", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    render(
      <MantineProvider env="test">
        <form onSubmit={onSubmit}>
          <AnnouncementMessageEditor initialContent={null} onChange={vi.fn()} />
        </form>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    fireEvent.change(screen.getByRole("textbox", { name: "URL" }), {
      target: { value: "https://status.example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes only the link popover on Escape inside a modal", () => {
    const onClose = vi.fn();
    render(
      <MantineProvider env="test">
        <Modal opened onClose={onClose} title="New announcement">
          <AnnouncementMessageEditor initialContent={null} onChange={vi.fn()} />
        </Modal>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    fireEvent.keyDown(screen.getByRole("textbox", { name: "URL" }), {
      key: "Escape",
    });

    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Message" }),
    );
  });

  it("opens the link popover with Mod-k", () => {
    renderEditor(doc({ type: "text", text: "Hello" }));
    expect(screen.queryByRole("textbox", { name: "URL" })).toBeNull();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Message" }), {
      key: "k",
      ctrlKey: true,
      metaKey: true,
    });

    expect(screen.getByRole("textbox", { name: "URL" })).toBeTruthy();
  });
});
