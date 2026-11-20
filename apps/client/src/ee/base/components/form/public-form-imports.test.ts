import { describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/property-types/property-type.registry", () => {
  throw new Error("the public form must not load the property registry");
});

describe("the public form page", () => {
  it("loads without the property registry", async () => {
    await expect(import("@/ee/base/pages/public-form-page.tsx")).resolves.toBeDefined();
  });
});
