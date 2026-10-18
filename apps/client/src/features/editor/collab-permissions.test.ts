import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { IPage } from "@/features/page/types/page.types";
import { applyCollabAccess, isForbiddenClose } from "./collab-permissions";

const keys = { pageId: "page-1", slugId: "slug-1" };

const fetchPage = vi.fn<() => Promise<IPage>>();
let queryClient: QueryClient;

const page = (overrides: Partial<IPage> = {}) =>
  ({
    id: "page-1",
    slugId: "slug-1",
    permissions: { canEdit: true, hasRestriction: false },
    ...overrides,
  }) as IPage;

const state = (key: string) =>
  queryClient.getQueryState<IPage>(["pages", key]);

beforeEach(() => {
  fetchPage.mockReset();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryDefaults(["pages"], { queryFn: () => fetchPage() });
  queryClient.setQueryData(["pages", "slug-1"], page());
  queryClient.setQueryData(["pages", "page-1"], page());
});

describe("applyCollabAccess", () => {
  it("makes the cached page read-only when the connection drops to read", async () => {
    await applyCollabAccess(queryClient, keys, "read");

    expect(state("slug-1").data.permissions.canEdit).toBe(false);
    expect(state("page-1").data.permissions.canEdit).toBe(false);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("shows the approved view when approval was switched on under a reader", async () => {
    const controlled = page({
      approval: { controlled: true, canAccessDraft: false, unpublished: false },
    });
    fetchPage.mockResolvedValue(controlled);

    await applyCollabAccess(queryClient, keys, "none");

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(state("slug-1").status).toBe("success");
    expect(state("slug-1").data).toEqual(controlled);
  });

  it("shows not found when the page info itself is refused", async () => {
    fetchPage.mockRejectedValue({ status: 404 });

    await applyCollabAccess(queryClient, keys, "none");

    expect(state("slug-1").status).toBe("error");
    expect(state("slug-1").error).toEqual({ status: 404 });
  });

  it("keeps treating the access as lost when the server still serves an ordinary page", async () => {
    fetchPage.mockResolvedValue(page());

    await applyCollabAccess(queryClient, keys, "none");

    expect(state("slug-1").status).toBe("error");
    expect(state("slug-1").error).toMatchObject({ status: 403 });
    expect(state("slug-1").data).toBeUndefined();
  });

  it("treats a user who also lost draft access as locked out", async () => {
    fetchPage.mockResolvedValue(
      page({
        approval: { controlled: true, canAccessDraft: true, unpublished: false },
      }),
    );

    await applyCollabAccess(queryClient, keys, "none");

    expect(state("slug-1").status).toBe("error");
    expect(state("slug-1").error).toMatchObject({ status: 403 });
  });

  it("checks with the server once when the message and the close both arrive", async () => {
    fetchPage.mockResolvedValue(
      page({
        approval: { controlled: true, canAccessDraft: false, unpublished: false },
      }),
    );

    await Promise.all([
      applyCollabAccess(queryClient, keys, "none"),
      applyCollabAccess(queryClient, keys, "none"),
    ]);

    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe("isForbiddenClose", () => {
  it("recognizes the close hocuspocus sends to a refused connection", () => {
    expect(isForbiddenClose({ code: 1000, reason: "Forbidden" })).toBe(true);
    expect(isForbiddenClose({ code: 4403, reason: "" })).toBe(true);
  });

  it("ignores other closes", () => {
    expect(isForbiddenClose({ code: 1006, reason: "" })).toBe(false);
    expect(isForbiddenClose({ code: 1000, reason: "Reset Connection" })).toBe(
      false,
    );
    expect(isForbiddenClose(undefined)).toBe(false);
  });
});
