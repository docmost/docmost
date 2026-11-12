import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("@/ee/base/queries/base-row-query", () => ({
  invalidateBaseRows: vi.fn(),
  invalidateCalendarRows: vi.fn(),
}));

import { getDefaultStore, type WritableAtom } from "jotai";
import { queryClient } from "@/main.tsx";
import { editingCellAtomFamily } from "@/ee/base/atoms/base-atoms";
import type { EditingCell } from "@/ee/base/types/base.types";
import { invalidateBaseRows, invalidateCalendarRows } from "@/ee/base/queries/base-row-query";
import { cancelRowsRefresh, scheduleRowsRefresh } from "./rows-refresh";

const pendingRowMutation = (pageId: string) => {
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: ["base-row"],
    mutationFn: (_variables: { pageId: string }) => new Promise<void>(() => {}),
  });
  void mutation.execute({ pageId });
};

const editCell = (pageId: string, cell: EditingCell) =>
  getDefaultStore().set(
    editingCellAtomFamily(pageId) as unknown as WritableAtom<EditingCell, [EditingCell], void>,
    cell,
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(invalidateBaseRows).mockClear();
  vi.mocked(invalidateCalendarRows).mockClear();
});
afterEach(() => {
  editCell("p1", null);
  editCell("p2", null);
  cancelRowsRefresh("p1");
  cancelRowsRefresh("p2");
  queryClient.clear();
  vi.useRealTimers();
});

describe("scheduleRowsRefresh", () => {
  it("runs one refresh 300 ms after a burst of requests", () => {
    scheduleRowsRefresh("p1", "calendar");
    scheduleRowsRefresh("p1", "calendar");
    scheduleRowsRefresh("p1", "calendar");
    vi.advanceTimersByTime(299);
    expect(invalidateCalendarRows).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(invalidateCalendarRows).toHaveBeenCalledTimes(1);
    expect(invalidateCalendarRows).toHaveBeenCalledWith("p1");
    expect(invalidateBaseRows).not.toHaveBeenCalled();
  });

  it("widens a pending refresh to all rows and never narrows it", () => {
    scheduleRowsRefresh("p1", "calendar");
    scheduleRowsRefresh("p1", "all");
    scheduleRowsRefresh("p1", "calendar");
    vi.advanceTimersByTime(300);
    expect(invalidateBaseRows).toHaveBeenCalledWith("p1");
    expect(invalidateCalendarRows).not.toHaveBeenCalled();
  });

  it("leaves 2 s between two refreshes of one base", () => {
    scheduleRowsRefresh("p1", "all");
    vi.advanceTimersByTime(300);
    scheduleRowsRefresh("p1", "all");
    vi.advanceTimersByTime(1999);
    expect(invalidateBaseRows).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(invalidateBaseRows).toHaveBeenCalledTimes(2);
  });

  it("waits for a pending row mutation of the same base", () => {
    pendingRowMutation("p1");
    scheduleRowsRefresh("p1", "all");
    vi.advanceTimersByTime(3000);
    expect(invalidateBaseRows).not.toHaveBeenCalled();
  });

  it("keeps waiting for a pending row mutation as long as it waits for a fetch", () => {
    pendingRowMutation("p1");
    scheduleRowsRefresh("p1", "all");
    vi.advanceTimersByTime(299 + 99 * 300);
    expect(invalidateBaseRows).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(invalidateBaseRows).toHaveBeenCalledTimes(1);
  });

  it("ignores a pending row mutation of another base", () => {
    pendingRowMutation("p2");
    scheduleRowsRefresh("p1", "all");
    vi.advanceTimersByTime(300);
    expect(invalidateBaseRows).toHaveBeenCalledWith("p1");
  });

  it("waits while rows of that base are being fetched", async () => {
    let finish!: (value: unknown) => void;
    void queryClient.fetchQuery({
      queryKey: ["base-rows", "p1", "x"],
      queryFn: () => new Promise((resolve) => (finish = resolve)),
    });
    scheduleRowsRefresh("p1", "all");
    await vi.advanceTimersByTimeAsync(900);
    expect(invalidateBaseRows).not.toHaveBeenCalled();
    finish({});
    await vi.advanceTimersByTimeAsync(300);
    expect(invalidateBaseRows).toHaveBeenCalledTimes(1);
  });

  it("drops a pending refresh when it is cancelled", () => {
    scheduleRowsRefresh("p1", "all");
    cancelRowsRefresh("p1");
    vi.advanceTimersByTime(5000);
    expect(invalidateBaseRows).not.toHaveBeenCalled();
  });

  describe("while a cell is in edit mode", () => {
    it("puts the refresh off for as long as the cell is edited", () => {
      editCell("p1", { rowId: "r1", propertyId: "prpdue0000001" });
      scheduleRowsRefresh("p1", "all");
      vi.advanceTimersByTime(300);
      expect(invalidateBaseRows).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(invalidateBaseRows).not.toHaveBeenCalled();
    });

    it("runs the refresh 300 ms after edit mode ends", () => {
      editCell("p1", { rowId: "r1", propertyId: "prpdue0000001" });
      scheduleRowsRefresh("p1", "all");
      vi.advanceTimersByTime(60_000);
      editCell("p1", { rowId: "r1", propertyId: "prptext000001" });
      vi.advanceTimersByTime(1000);
      expect(invalidateBaseRows).not.toHaveBeenCalled();
      editCell("p1", null);
      vi.advanceTimersByTime(299);
      expect(invalidateBaseRows).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(invalidateBaseRows).toHaveBeenCalledTimes(1);
      expect(invalidateBaseRows).toHaveBeenCalledWith("p1");
    });

    it("keeps 2 s after the last refresh when edit mode ends soon after it", () => {
      scheduleRowsRefresh("p1", "all");
      vi.advanceTimersByTime(300);
      editCell("p1", { rowId: "r1", propertyId: "prpdue0000001" });
      scheduleRowsRefresh("p1", "all");
      vi.advanceTimersByTime(500);
      editCell("p1", null);
      vi.advanceTimersByTime(1499);
      expect(invalidateBaseRows).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(invalidateBaseRows).toHaveBeenCalledTimes(2);
    });

    it("still waits for a pending row mutation once edit mode ends", () => {
      editCell("p1", { rowId: "r1", propertyId: "prpdue0000001" });
      pendingRowMutation("p1");
      scheduleRowsRefresh("p1", "all");
      editCell("p1", null);
      vi.advanceTimersByTime(3000);
      expect(invalidateBaseRows).not.toHaveBeenCalled();
    });

    it("holds nothing in another base", () => {
      editCell("p2", { rowId: "r1", propertyId: "prpdue0000001" });
      scheduleRowsRefresh("p1", "all");
      vi.advanceTimersByTime(300);
      expect(invalidateBaseRows).toHaveBeenCalledTimes(1);
      expect(invalidateBaseRows).toHaveBeenCalledWith("p1");
    });

    it("drops a held refresh when it is cancelled", () => {
      editCell("p1", { rowId: "r1", propertyId: "prpdue0000001" });
      scheduleRowsRefresh("p1", "all");
      vi.advanceTimersByTime(300);
      cancelRowsRefresh("p1");
      editCell("p1", null);
      vi.advanceTimersByTime(5000);
      expect(invalidateBaseRows).not.toHaveBeenCalled();
    });
  });
});
