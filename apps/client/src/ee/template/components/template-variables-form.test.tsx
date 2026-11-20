import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { getTemplateById } from "../services/template-service";
import type { ITemplate } from "../types/template.types";
import { useTemplateVariables } from "./template-variables-form";

vi.mock("../services/template-service", () => ({ getTemplateById: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/features/space/queries/space-query", () => ({ useGetSpaceBySlugQuery: () => ({}) }));
vi.mock("@/features/editor/extensions/extensions", async () => ({
  mainExtensions: [(await import("@tiptap/starter-kit")).StarterKit],
}));

beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
});
afterEach(cleanup);
afterAll(() => vi.unstubAllGlobals());

const field = {
  type: "templateVariable",
  attrs: { id: "11111111-1111-7111-8111-111111111111", name: "Project", fieldType: "text", options: [] },
};

function pickTemplate(content: ITemplate["content"], action = "Create page") {
  const template = { id: "brief", title: "Project brief", content } as ITemplate;
  vi.mocked(getTemplateById).mockResolvedValue(template);
  const use = vi.fn();
  function Picker() {
    const { choose, form } = useTemplateVariables(use, action);
    return <><button onClick={() => choose(template)}>Use</button>{form}</>;
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider env="test"><MemoryRouter><Picker /></MemoryRouter></MantineProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  return { template, use };
}

it.each(["Create page", "Apply template"])("preserves the document and resolves inline fields for %s", async (action) => {
  const summary = { ...field, attrs: { ...field.attrs, id: crypto.randomUUID(), name: "Summary", fieldType: "multiline" } };
  const status = { ...field, attrs: { id: crypto.randomUUID(), name: "Status", fieldType: "select", options: ["Draft", "Ready"] } };
  const repeated = { ...field, attrs: { ...field.attrs, id: crypto.randomUUID(), name: "project" } };
  const { template, use } = pickTemplate({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Kickoff" }] },
      { type: "paragraph", content: [{ type: "text", text: "Prepared for " }, field] },
      { type: "blockquote", content: [{ type: "paragraph", content: [repeated] }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [summary] }] }] },
      { type: "paragraph", content: [status] },
    ],
  }, action);
  const [first, second] = await screen.findAllByRole<HTMLInputElement>("textbox", { name: "Project" });
  expect(screen.getByRole("document").getAttribute("contenteditable")).toBe("false");
  expect(screen.getByRole("heading", { name: "Kickoff", level: 2 })).toBeTruthy();
  expect(first.closest("p")?.textContent).toContain("Prepared for ");
  expect(second.closest("blockquote")).toBeTruthy();
  const textarea = within(screen.getByRole("listitem")).getByRole("textbox", { name: "Summary" });
  const select = screen.getByRole("combobox", { name: "Status" });
  expect(textarea.tagName).toBe("TEXTAREA");
  fireEvent.change(second, { target: { value: "Atlas" } });
  expect(first.value).toBe("Atlas");
  fireEvent.change(textarea, { target: { value: "Line one\nLine two" } });
  fireEvent.change(select, { target: { value: "Ready" } });
  expect(use).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(use).toHaveBeenCalledExactlyOnceWith(template, {
    [field.attrs.id]: "Atlas", [summary.attrs.id]: "Line one\nLine two", [status.attrs.id]: "Ready",
  });
});

it("discards draft answers when the user cancels and reopens the template", async () => {
  const { use } = pickTemplate({ type: "doc", content: [{ type: "paragraph", content: [field] }] });
  fireEvent.change(await screen.findByRole("textbox", { name: "Project" }), { target: { value: "Draft" } });
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(use).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  expect((await screen.findByRole<HTMLInputElement>("textbox", { name: "Project" })).value).toBe("");
});

it("keeps the entered values available when applying the template fails", async () => {
  const { use } = pickTemplate({ type: "doc", content: [{ type: "paragraph", content: [field] }] }, "Apply template");
  use.mockResolvedValueOnce(false);
  const input = await screen.findByRole<HTMLInputElement>("textbox", { name: "Project" });
  fireEvent.change(input, { target: { value: "Atlas" } });
  const apply = screen.getByRole<HTMLButtonElement>("button", { name: "Apply template" });
  fireEvent.click(apply);
  await waitFor(() => expect(apply.disabled).toBe(false));
  expect(input.value).toBe("Atlas");
  fireEvent.click(apply);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(use).toHaveBeenCalledTimes(2);
});

it("continues directly for a template without variables", async () => {
  const { template, use } = pickTemplate({ type: "doc", content: [{ type: "paragraph" }] });
  await waitFor(() => expect(use).toHaveBeenCalledExactlyOnceWith(template));
  expect(screen.queryByRole("dialog")).toBeNull();
});
