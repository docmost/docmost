import { beforeEach, expect, it, vi } from "vitest";
import api from "@/lib/api-client";
import { applyTemplate, useTemplate } from "./template-service";

vi.mock("@/lib/api-client", () => ({ default: { post: vi.fn() } }));

beforeEach(() => {
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: {} });
});

it.each(["create", "apply"])(
  "submits the template revision shown to the user on %s",
  async (action) => {
    const template = {
      id: "template-1",
      updatedAt: "2026-11-18T09:00:00.000Z",
    };
    const variableValues = { "field-1": "500" };
    if (action === "create") {
      await useTemplate({ template, spaceId: "space-1", variableValues });
    } else {
      await applyTemplate({ template, pageId: "page-1", variableValues });
    }
    expect(api.post).toHaveBeenCalledWith(
      action === "create" ? "/templates/use" : "/templates/apply",
      {
        templateId: template.id,
        templateUpdatedAt: template.updatedAt,
        variableValues,
        ...(action === "create"
          ? { spaceId: "space-1" }
          : { pageId: "page-1" }),
      },
    );
  },
);
