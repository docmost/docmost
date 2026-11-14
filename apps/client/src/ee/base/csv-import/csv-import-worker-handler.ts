import {
  convertCsvText,
  profileCsvText,
} from "@/ee/base/csv-import/csv-import-parse";
import { IMPORT_FILE_TYPE } from "@/ee/base/csv-import/csv-import.constants";
import type {
  CsvDelimiter,
  CsvWorkerProgress,
  CsvWorkerRequest,
  CsvWorkerResponse,
} from "@/ee/base/csv-import/csv-import.types";

type LoadedCsv = {
  text: string;
  delimiter: CsvDelimiter;
  hasHeader: boolean;
  rowCount: number;
};

type LoadRequest = Extract<CsvWorkerRequest, { type: "load" }>;
type ConvertRequest = Extract<CsvWorkerRequest, { type: "convert" }>;

function bomEncoding(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return "utf-16le";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return "utf-16be";
  return null;
}

// TextDecoder over the whole file avoids split characters at chunk boundaries
function decode(bytes: Uint8Array, encoding: string | null): { text: string; encoding: string } {
  const chosen = encoding ?? bomEncoding(bytes);
  if (chosen) return { text: new TextDecoder(chosen).decode(bytes), encoding: chosen };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
  }
}

// messages arrive while a file is still being read, so only the newest load may land
export function createCsvWorkerHandler(
  post: (message: CsvWorkerResponse) => void,
): (request: CsvWorkerRequest) => Promise<void> {
  let loaded: LoadedCsv | null = null;
  let latestLoadId = 0;

  function progressReporter(id: number, phase: CsvWorkerProgress["phase"], total: number) {
    let last = 0;
    return (processed: number) => {
      if (processed - last < total / 50) return;
      last = processed;
      post({ id, type: "progress", phase, processed, total });
    };
  }

  async function load(request: LoadRequest) {
    latestLoadId = request.id;
    loaded = null;
    const bytes = new Uint8Array(await request.file.arrayBuffer());
    if (request.id !== latestLoadId) return;
    const { text, encoding } = decode(bytes, request.encoding);
    const profile = profileCsvText(
      text,
      request,
      request.locale,
      progressReporter(request.id, "reading", text.length),
    );
    loaded = {
      text,
      delimiter: profile.delimiter,
      hasHeader: request.hasHeader,
      rowCount: profile.rowCount,
    };
    post({ id: request.id, type: "loaded", ...profile, encoding });
  }

  function convert(request: ConvertRequest) {
    if (!loaded) throw new Error("No file loaded");
    const { parts, rowCount, skippedValues } = convertCsvText(
      loaded.text,
      loaded,
      request.columns,
      progressReporter(request.id, "converting", loaded.rowCount),
    );
    post({
      id: request.id,
      type: "converted",
      blob: new Blob(parts, { type: IMPORT_FILE_TYPE }),
      rowCount,
      skippedValues,
    });
  }

  return async (request) => {
    try {
      if (request.type === "load") await load(request);
      else convert(request);
    } catch (err) {
      if (request.type === "load" && request.id !== latestLoadId) return;
      post({
        id: request.id,
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}
