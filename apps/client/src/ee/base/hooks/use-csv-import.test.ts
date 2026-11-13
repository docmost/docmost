import { act, renderHook, waitFor } from "@testing-library/react";
import { CanceledError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IBase } from "@/ee/base/types/base.types";
import type { CsvConvertOutput, CsvLoadResult } from "@/ee/base/csv-import/csv-import.types";
import { useCsvImport } from "./use-csv-import";

const mocks = vi.hoisted(() => ({
  worker: { load: vi.fn(), convert: vi.fn(), terminate: vi.fn() },
  importBaseCsv: vi.fn(),
  trackBaseImport: vi.fn(),
  show: vi.fn(),
}));

vi.mock("@/ee/base/csv-import/csv-import-worker-client", () => ({
  createCsvImportWorker: () => mocks.worker,
  CsvWorkerSupersededError: class extends Error {},
}));
vi.mock("@/ee/base/services/base-service", () => ({ importBaseCsv: mocks.importBaseCsv }));
vi.mock("@/ee/base/csv-import/track-base-import", () => ({
  trackBaseImport: mocks.trackBaseImport,
}));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.show } }));
vi.mock("@/lib/config.ts", () => ({ getFileImportSizeLimit: () => 200 * 1024 * 1024 }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key.replace(/{{(\w+)}}/g, (_match, name) => String(values?.[name] ?? "")),
    i18n: { language: "en-US" },
  }),
}));

const base = {
  id: "page-1",
  properties: [
    {
      id: "prpTitle",
      name: "Title",
      type: "text",
      isPrimary: true,
      pageId: "page-1",
      position: "a0",
      typeOptions: {},
      workspaceId: "ws",
      createdAt: "",
      updatedAt: "",
    },
  ],
} as unknown as IBase;

const loaded: CsvLoadResult = {
  headers: ["Name"],
  previewRows: [["Ada"]],
  rowCount: 1,
  delimiter: ",",
  encoding: "utf-8",
  profiles: [
    {
      nonEmpty: 1,
      samples: ["Ada"],
      distinctCount: 1,
      distinctTokenCount: 1,
      hasMultipleValues: false,
      hints: { dateOrder: "MDY", decimalSeparator: ".", listSeparator: "," },
      suggestion: { type: "text" },
      issues: {},
    },
  ],
};

const converted: CsvConvertOutput = {
  blob: new Blob(['["Ada"]\n']),
  rowCount: 1,
  skippedValues: 0,
};

async function renderWithFile(onImported = vi.fn()) {
  const view = renderHook(() => useCsvImport(base, onImported));
  act(() => view.result.current.selectFile(new File(["Name\nAda\n"], "people.csv")));
  await waitFor(() => expect(view.result.current.loaded).not.toBeNull());
  return view;
}

describe("useCsvImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.worker.load.mockResolvedValue(loaded);
    mocks.worker.convert.mockResolvedValue(converted);
  });

  it("finishes an import the dialog was closed on and hands it to the tracker", async () => {
    let finishConvert!: (output: CsvConvertOutput) => void;
    mocks.worker.convert.mockReturnValue(new Promise((resolve) => (finishConvert = resolve)));
    mocks.importBaseCsv.mockResolvedValue({ id: "task-1" });
    const { result, unmount } = await renderWithFile();

    act(() => void result.current.startImport());
    unmount();
    expect(mocks.worker.terminate).not.toHaveBeenCalled();

    await act(async () => finishConvert(converted));
    await waitFor(() =>
      expect(mocks.trackBaseImport).toHaveBeenCalledWith({
        fileTaskId: "task-1",
        pageId: "page-1",
        totalRows: 1,
        skippedValues: 0,
      }),
    );
    expect(mocks.worker.terminate).toHaveBeenCalled();
  });

  it("keeps uploading after the dialog closes", async () => {
    let finishUpload!: (task: { id: string }) => void;
    mocks.importBaseCsv.mockReturnValue(new Promise((resolve) => (finishUpload = resolve)));
    const { result, unmount } = await renderWithFile();

    act(() => void result.current.startImport());
    await waitFor(() => expect(mocks.importBaseCsv).toHaveBeenCalled());
    unmount();

    const [, options] = mocks.importBaseCsv.mock.calls[0];
    expect(options.signal.aborted).toBe(false);
    await act(async () => finishUpload({ id: "task-1" }));
    expect(mocks.trackBaseImport).toHaveBeenCalled();
  });

  it("stops an upload when the user cancels", async () => {
    mocks.importBaseCsv.mockImplementation(
      (_data, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(new CanceledError()));
        }),
    );
    const { result } = await renderWithFile();

    act(() => void result.current.startImport());
    await waitFor(() => expect(mocks.importBaseCsv).toHaveBeenCalled());
    act(() => result.current.cancelImport());

    const [, options] = mocks.importBaseCsv.mock.calls[0];
    expect(options.signal.aborted).toBe(true);
    await act(async () => undefined);
    expect(mocks.trackBaseImport).not.toHaveBeenCalled();
    expect(mocks.show).not.toHaveBeenCalled();
  });

  it("tells the user in a toast when an import fails after the dialog closed", async () => {
    mocks.importBaseCsv.mockRejectedValue(new Error("network down"));
    const { result, unmount } = await renderWithFile();

    act(() => void result.current.startImport());
    unmount();

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith({
        color: "red",
        title: "Import failed",
        message: "Failed to import CSV",
      }),
    );
  });

  it("shows the problem in the dialog while it is open", async () => {
    mocks.importBaseCsv.mockRejectedValue(new Error("network down"));
    const { result } = await renderWithFile();

    await act(() => result.current.startImport());

    expect(result.current.error).toBe("Failed to import CSV");
    expect(result.current.progress).toBeNull();
    expect(mocks.show).not.toHaveBeenCalled();
  });
});
