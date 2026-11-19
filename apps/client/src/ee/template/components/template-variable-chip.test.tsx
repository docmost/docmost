import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { EditorProvider } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { EditableTemplateVariable, TemplateVariableWithChip } from "./template-variable-node";

vi.mock("@/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name: string }) => key.replace("{{name}}", values?.name ?? ""),
  }),
}));

beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(cleanup);
afterAll(() => vi.unstubAllGlobals());

function renderTemplate(editable: boolean) {
  const project = { id: crypto.randomUUID(), name: "Project", fieldType: "text", options: [] };
  const fields = [
    project,
    project,
    { id: crypto.randomUUID(), name: "Summary", fieldType: "multiline", options: [] },
    { id: crypto.randomUUID(), name: "Status", fieldType: "select", options: ["Draft"] },
  ];
  const content = {
    type: "doc",
    content: fields.map((attrs) => ({
      type: "paragraph",
      content: [{ type: "templateVariable", attrs }],
    })),
  };
  render(
    <MantineProvider env="test">
      <ModalsProvider>
        <EditorProvider
          editable={editable}
          extensions={[StarterKit, editable ? EditableTemplateVariable : TemplateVariableWithChip]}
          content={content}
        />
      </ModalsProvider>
    </MantineProvider>,
  );
}

it("shows each field type inline in the preview", async () => {
  renderTemplate(false);
  expect(await screen.findAllByText("Single-line text")).toHaveLength(2);
  expect(screen.getByText("Multi-line text")).toBeTruthy();
  expect(screen.getByText("Select")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("updates the visible type on every occurrence when a field is edited", async () => {
  renderTemplate(true);
  const name = "Edit variable Project";
  const chips = await screen.findAllByRole("button", { name, description: "Single-line text" });
  expect(chips).toHaveLength(2);
  fireEvent.click(chips[1]);
  fireEvent.click(await screen.findByRole("combobox", { name: "Field type" }));
  fireEvent.click(screen.getByRole("option", { name: "Multi-line text" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => {
    const updated = screen.getAllByRole("button", { name, description: "Multi-line text" });
    expect(updated).toHaveLength(2);
    for (const chip of updated) expect(within(chip).getByText("Multi-line text")).toBeTruthy();
  });
});
