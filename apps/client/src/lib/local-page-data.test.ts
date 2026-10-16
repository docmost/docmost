import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteLocalPageData } from "./local-page-data";

function stubIndexedDB(names: string[]) {
  const deleteDatabase = vi.fn(() => {
    const request: Record<string, () => void> = {};
    setTimeout(() => request.onsuccess?.());
    return request;
  });
  vi.stubGlobal("indexedDB", {
    databases: async () => names.map((name) => ({ name, version: 1 })),
    deleteDatabase,
  });
  return deleteDatabase;
}

describe("deleteLocalPageData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes only the page databases", async () => {
    const deleteDatabase = stubIndexedDB(["page.a", "page.b", "other-db"]);

    await deleteLocalPageData();

    expect(deleteDatabase.mock.calls).toEqual([["page.a"], ["page.b"]]);
  });

  it("does nothing when the browser cannot list databases", async () => {
    vi.stubGlobal("indexedDB", { deleteDatabase: vi.fn() });

    await expect(deleteLocalPageData()).resolves.toBeUndefined();
  });
});
