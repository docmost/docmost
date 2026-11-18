import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IBaseProperty } from "@/ee/base/types/base.types";
import { CardField } from "./card-field";

vi.mock("@/main.tsx", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

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
});
