import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteLocalPageData, failedPageWrites } from "./local-page-data";

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
    const deleteDatabase = stubIndexedDB([
      "page.a",
      "page.b.user.account",
      "other-db",
    ]);

    await deleteLocalPageData();

    expect(deleteDatabase.mock.calls).toEqual([
      ["page.a"],
      ["page.b.user.account"],
    ]);
  });

  it("does nothing when the browser cannot list databases", async () => {
    vi.stubGlobal("indexedDB", { deleteDatabase: vi.fn() });

    await expect(deleteLocalPageData()).resolves.toBeUndefined();
  });

  it("clears fallback drafts and recovery copies on explicit sign-out", async () => {
    stubIndexedDB([]);
    const database = "page.scratch.user.writer";
    failedPageWrites.keep(database, "draft", "backup");
    failedPageWrites.keep(database + ".recovery", "writer:1", "copy");
    localStorage.setItem("sidebarWidth", "300");
    await deleteLocalPageData();
    expect(failedPageWrites.read(database).size).toBe(0);
    expect(failedPageWrites.read(database + ".recovery").size).toBe(0);
    expect(localStorage.getItem("sidebarWidth")).toBe("300");
    localStorage.removeItem("sidebarWidth");
  });
});
