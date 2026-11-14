import type {
  CsvConvertColumn,
  CsvConvertOutput,
  CsvLoadOptions,
  CsvLoadResult,
  CsvWorkerProgress,
  CsvWorkerRequest,
  CsvWorkerResponse,
} from "@/ee/base/csv-import/csv-import.types";

type ProgressHandler = (progress: CsvWorkerProgress) => void;

type PendingRequest = {
  resolve: (response: CsvWorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: ProgressHandler;
};

export type CsvImportWorkerClient = {
  load: (
    file: File,
    options: CsvLoadOptions,
    onProgress?: ProgressHandler,
  ) => Promise<CsvLoadResult>;
  convert: (
    columns: CsvConvertColumn[],
    onProgress?: ProgressHandler,
  ) => Promise<CsvConvertOutput>;
  terminate: () => void;
};

export class CsvWorkerSupersededError extends Error {}

export function createCsvImportWorker(): CsvImportWorkerClient {
  const worker = new Worker(new URL("./csv-import.worker.ts", import.meta.url), {
    type: "module",
  });
  const pending = new Map<number, PendingRequest>();
  let nextId = 1;

  const rejectAll = (error: Error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<CsvWorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) return;
    if (message.type === "progress") {
      request.onProgress?.(message);
      return;
    }
    pending.delete(message.id);
    if (message.type === "error") request.reject(new Error(message.message));
    else request.resolve(message);
  };

  worker.onerror = (event) => {
    rejectAll(new Error(event.message || "The file could not be read"));
  };

  // a newer request makes older answers irrelevant; the worker drops loads a newer load replaced
  const send = (
    request: CsvWorkerRequest,
    onProgress?: ProgressHandler,
  ): Promise<CsvWorkerResponse> => {
    rejectAll(new CsvWorkerSupersededError());
    return new Promise((resolve, reject) => {
      pending.set(request.id, { resolve, reject, onProgress });
      worker.postMessage(request);
    });
  };

  return {
    load: async (file, options, onProgress) => {
      const response = await send(
        { id: nextId++, type: "load", file, locale: navigator.language, ...options },
        onProgress,
      );
      if (response.type !== "loaded") throw new Error("Unexpected worker response");
      const { id: _id, type: _type, ...result } = response;
      return result;
    },
    convert: async (columns, onProgress) => {
      const response = await send({ id: nextId++, type: "convert", columns }, onProgress);
      if (response.type !== "converted") throw new Error("Unexpected worker response");
      const { id: _id, type: _type, ...result } = response;
      return result;
    },
    terminate: () => {
      rejectAll(new CsvWorkerSupersededError());
      worker.terminate();
    },
  };
}
