import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { getTemplateById } from "../services/template-service";
import type { ITemplate } from "../types/template.types";
import { useTemplateVariables } from "./template-variables-form";

vi.mock("../services/template-service", () => ({ getTemplateById: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

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

function pickTemplate(content: ITemplate["content"]) {
  const template = { id: "brief", title: "Project brief", content } as ITemplate;
  vi.mocked(getTemplateById).mockResolvedValue(template);
  const use = vi.fn();
  function Picker() {
    const { choose, form } = useTemplateVariables(use, "Create page");
    return <><button onClick={() => choose(template)}>Use</button>{form}</>;
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider env="test"><Picker /></MantineProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Use" }));
  return { template, use };
}

it("submits one answer for repeated fields, only after the user confirms", async () => {
  const { template, use } = pickTemplate({
    type: "doc", content: [{ type: "paragraph", content: [field, field] }],
  });
  const input = await screen.findByRole("textbox", { name: "Project" });
  expect(use).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "Atlas" } });
  fireEvent.click(screen.getByRole("button", { name: "Create page" }));
  expect(use).toHaveBeenCalledExactlyOnceWith(template, { [field.attrs.id]: "Atlas" });
});

it("allows cancelling without applying the template", async () => {
  const { use } = pickTemplate({ type: "doc", content: [{ type: "paragraph", content: [field] }] });
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(use).not.toHaveBeenCalled();
});

it("continues directly for a template without variables", async () => {
  const { template, use } = pickTemplate({ type: "doc", content: [{ type: "paragraph" }] });
  await waitFor(() => expect(use).toHaveBeenCalledExactlyOnceWith(template));
  expect(screen.queryByRole("dialog")).toBeNull();
});
