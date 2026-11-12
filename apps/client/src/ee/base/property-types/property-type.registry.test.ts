import { describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));

import { isPropertyConverting } from "./property-type.registry";

describe("isPropertyConverting", () => {
  it.each([
    [{}, false],
    [{ pendingType: null, pendingTypeOptions: null }, false],
    [{ pendingType: "number" as const }, true],
    [{ pendingType: null, pendingTypeOptions: { includeTime: true } }, true],
    [{ pendingType: "date" as const, pendingTypeOptions: { includeTime: false } }, true],
  ])("reads %j as %s", (property, converting) => {
    expect(isPropertyConverting(property)).toBe(converting);
  });
});
