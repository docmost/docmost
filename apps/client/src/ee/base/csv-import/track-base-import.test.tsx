import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultStore } from "jotai";
import {
  baseImportProgressAtomFamily,
  baseImportResultAtomFamily,
} from "@/ee/base/atoms/base-atoms";
import { trackBaseImport } from "./track-base-import";
import type { BaseImportResult } from "./csv-import.types";

const mocks = vi.hoisted(() => ({
  show: vi.fn(),
  update: vi.fn(),
  getFileTaskById: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: mocks.show, update: mocks.update },
}));
vi.mock("@/main", () => ({ queryClient: { invalidateQueries: mocks.invalidateQueries } }));
vi.mock("@/i18n.ts", () => ({
  default: {
    language: "en-US",
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
  },
}));
vi.mock("@/features/file-task/services/file-task-service", () => ({
  getFileTaskById: mocks.getFileTaskById,
}));

const store = getDefaultStore();
let pageCount = 0;

function setup() {
  const pageId = `page-${++pageCount}`;
  return {
    input: { fileTaskId: "task-1", pageId, totalRows: 10, skippedValues: 2 },
    progressAtom: baseImportProgressAtomFamily(pageId),
    resultAtom: baseImportResultAtomFamily(pageId),
  };
}

function succeeded(fileTaskId: string): BaseImportResult {
  return { fileTaskId, status: "success", importedRows: 10, skippedValues: 1, error: null };
}

// toasts that no longer spin: the success or failure ones
function settledToasts() {
  return [...mocks.show.mock.calls, ...mocks.update.mock.calls]
    .map(([notification]) => notification)
    .filter((notification) => notification.loading === false);
}

describe("trackBaseImport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows a closable progress toast and settles it once", async () => {
    const { input, progressAtom, resultAtom } = setup();
    mocks.getFileTaskById.mockResolvedValue({ status: "success", metadata: {}, errorMessage: null });

    trackBaseImport(input);
    expect(mocks.show).toHaveBeenCalledWith(
      expect.objectContaining({ loading: true, withCloseButton: true, message: "Waiting to start" }),
    );

    store.set(resultAtom, succeeded("task-1"));
    store.set(resultAtom, { ...succeeded("task-1"), importedRows: 9 });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(settledToasts()).toEqual([
      expect.objectContaining({
        title: "Import complete",
        message: "10 rows imported 3 values left empty",
      }),
    ]);
    expect(mocks.getFileTaskById).not.toHaveBeenCalled();
    expect(store.get(progressAtom)).toBeNull();
  });

  it("settles on a completion that arrived before tracking started", async () => {
    const { input, progressAtom, resultAtom } = setup();
    store.set(resultAtom, succeeded("task-1"));

    trackBaseImport(input);

    expect(settledToasts()).toEqual([expect.objectContaining({ title: "Import complete" })]);
    expect(store.get(progressAtom)).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.getFileTaskById).not.toHaveBeenCalled();
  });

  it("falls back to polling the task when no completion arrives", async () => {
    const { input, resultAtom } = setup();
    store.set(resultAtom, succeeded("task-0"));
    mocks.getFileTaskById
      .mockResolvedValueOnce({ status: "processing", metadata: {}, errorMessage: null })
      .mockResolvedValueOnce({ status: "failed", metadata: {}, errorMessage: "A property changed" });

    trackBaseImport(input);
    await vi.advanceTimersByTimeAsync(3000);
    expect(settledToasts()).toEqual([]);

    await vi.advanceTimersByTimeAsync(3000);
    expect(settledToasts()).toEqual([
      expect.objectContaining({ title: "Import failed", message: "A property changed" }),
    ]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.getFileTaskById).toHaveBeenCalledTimes(2);
  });

  it("keeps progress that arrived before tracking started", () => {
    const { input, progressAtom } = setup();
    store.set(progressAtom, { fileTaskId: "task-1", processedRows: 5, totalRows: 10 });

    trackBaseImport(input);

    expect(store.get(progressAtom)).toEqual({ fileTaskId: "task-1", processedRows: 5, totalRows: 10 });
    expect(mocks.show).toHaveBeenCalledWith(expect.objectContaining({ message: "5 of 10 rows" }));
  });

  it("shows the result as a new toast after the progress toast was closed", () => {
    const { input, resultAtom } = setup();
    trackBaseImport(input);
    const [[progressToast]] = mocks.show.mock.calls;

    progressToast.onClose();
    store.set(resultAtom, succeeded("task-1"));

    expect(mocks.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Import complete" }),
    );
    expect(mocks.show).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: progressToast.id, title: "Import complete" }),
    );
  });
});
