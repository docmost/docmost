import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { FilterGroup } from "@/ee/base/types/base.types";
import { useViewDraft } from "./use-view-draft";

afterEach(cleanup);

it("reads a released draft and promotes its is within filter unchanged", async () => {
  const filter: FilterGroup = {
    op: "and",
    children: [{ propertyId: "due", op: "isWithin", value: { mode: "range", preset: "thisWeek" } }],
  };
  localStorage.setItem(
    "docmost:base-view-draft:v1:u1:p1:v1",
    JSON.stringify({ filter, updatedAt: "2026-11-12T00:00:00.000Z" }),
  );
  const { result } = renderHook(() =>
    useViewDraft({ userId: "u1", pageId: "p1", viewId: "v1", baselineFilter: undefined, baselineSorts: undefined }),
  );
  await waitFor(() => expect(result.current.effectiveFilter).toEqual(filter));
  expect(result.current.buildPromotedConfig({})).toEqual({ filter, sorts: null });
});
