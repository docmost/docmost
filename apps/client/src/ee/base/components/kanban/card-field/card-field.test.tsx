import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import { CardField } from "./card-field";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  }),
}));
vi.mock("@/ee/base/queries/base-page-resolver-query", () => ({
  useResolvedPages: () => ({
    pages: new Map([
      [
        "b2",
        {
          id: "b2",
          slugId: "s2",
          title: "Projects",
          icon: null,
          spaceId: "sp",
          space: { id: "sp", slug: "eng", name: "Engineering" },
        },
      ],
    ]),
    isLoading: false,
  }),
}));

const property = (type: IBaseProperty["type"], typeOptions = {}) =>
  ({
    id: "p1",
    pageId: "base-1",
    name: "Done",
    type,
    position: "a",
    typeOptions,
    isPrimary: false,
  }) as IBaseProperty;

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
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CardField", () => {
  it.each([
    ["an unset", property("checkbox"), undefined, false],
    ["an unticked", property("checkbox"), false, false],
    ["a ticked", property("checkbox"), true, true],
    ["a false formula", property("formula", { resultType: "boolean" }), false, false],
  ])("shows the field name next to %s checkbox", (_, prop, value, checked) => {
    const { container } = render(
      <MantineProvider>
        <CardField property={prop} value={value} pageId="base-1" />
      </MantineProvider>,
    );

    const indicator = container.querySelector(".mantine-CheckboxIndicator-indicator");
    expect(screen.getByText("Done")).toBeTruthy();
    expect(indicator).not.toBeNull();
    expect(indicator?.hasAttribute("data-checked")).toBe(checked);
  });

  it("shows a relation's linked rows as links that don't open the card", () => {
    const relation = property("relation", { targetBaseId: "b2", allowMultiple: true });
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <MantineProvider>
          <div onClick={onOpen}>
            <CardField
              property={relation}
              value={undefined}
              pageId="base-1"
              relation={{ count: 1, rows: [{ id: "a", title: "Alpha" }] }}
            />
          </div>
        </MantineProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Open Alpha" }));

    expect(onOpen).not.toHaveBeenCalled();
    cleanup();
    render(
      <MantineProvider>
        <CardField
          property={relation}
          value={undefined}
          pageId="base-1"
          relation={{ count: 0, rows: [], restricted: true }}
        />
      </MantineProvider>,
    );
    expect(screen.getByText("No access")).toBeTruthy();
  });
});
