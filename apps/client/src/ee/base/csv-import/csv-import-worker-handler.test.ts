// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCsvWorkerHandler } from "./csv-import-worker-handler";
import type { CsvConvertColumn, CsvWorkerResponse } from "./csv-import.types";

const hints = { dateOrder: "MDY", decimalSeparator: ".", listSeparator: "," } as const;
const loadOptions = { encoding: null, delimiter: null, hasHeader: true, locale: "en-US" };

const columns: CsvConvertColumn[] = [
  { index: 0, type: "text", hints },
  { index: 1, type: "number", hints },
];

// a file whose bytes arrive only when the test says so
function heldFile(text: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  const file = {
    arrayBuffer: async () => {
      await released;
      return new TextEncoder().encode(text).buffer;
    },
  } as unknown as File;
  return { file, release };
}

function setup() {
  const posted: CsvWorkerResponse[] = [];
  const handle = createCsvWorkerHandler((message) => posted.push(message));
  return { posted, handle };
}

async function convertedText(posted: CsvWorkerResponse[]) {
  const message = posted.find((m) => m.type === "converted");
  return message?.type === "converted" ? message.blob.text() : null;
}

describe("createCsvWorkerHandler", () => {
  it("converts the newest file when an earlier read finishes last", async () => {
    const { posted, handle } = setup();
    const abandoned = heldFile("Secret,Salary\nAda,100\nGrace,200\n");
    const chosen = heldFile("Name,Points\nBob,1\n");

    const first = handle({ id: 1, type: "load", file: abandoned.file, ...loadOptions });
    const second = handle({ id: 2, type: "load", file: chosen.file, ...loadOptions });
    chosen.release();
    await second;
    abandoned.release();
    await first;

    expect(posted.every((m) => m.id === 2)).toBe(true);
    expect(posted.filter((m) => m.type === "loaded")).toEqual([
      expect.objectContaining({ id: 2, headers: ["Name", "Points"], rowCount: 1 }),
    ]);

    await handle({ id: 3, type: "convert", columns });
    expect(posted.at(-1)).toMatchObject({ id: 3, type: "converted", rowCount: 1 });
    expect(await convertedText(posted)).toBe('["Bob",1]\n');
  });

  it("drops an earlier read that finishes first", async () => {
    const { posted, handle } = setup();
    const abandoned = heldFile("Secret,Salary\nAda,100\n");
    const chosen = heldFile("Name,Points\nBob,1\n");

    const first = handle({ id: 1, type: "load", file: abandoned.file, ...loadOptions });
    const second = handle({ id: 2, type: "load", file: chosen.file, ...loadOptions });
    abandoned.release();
    await first;
    expect(posted).toEqual([]);

    chosen.release();
    await second;
    await handle({ id: 3, type: "convert", columns });
    expect(await convertedText(posted)).toBe('["Bob",1]\n');
  });

  it("refuses to convert while the newest file is still being read", async () => {
    const { posted, handle } = setup();
    const done = heldFile("Secret,Salary\nAda,100\n");
    done.release();
    await handle({ id: 1, type: "load", file: done.file, ...loadOptions });
    const pending = heldFile("Name,Points\nBob,1\n");
    void handle({ id: 2, type: "load", file: pending.file, ...loadOptions });

    await handle({ id: 3, type: "convert", columns });

    expect(posted.at(-1)).toEqual({ id: 3, type: "error", message: "No file loaded" });
  });

  it("posts nothing for a replaced read that fails", async () => {
    const { posted, handle } = setup();
    const broken = {
      arrayBuffer: () => Promise.reject(new Error("unreadable")),
    } as unknown as File;
    const chosen = heldFile("Name\nBob\n");

    const first = handle({ id: 1, type: "load", file: broken, ...loadOptions });
    void handle({ id: 2, type: "load", file: chosen.file, ...loadOptions });
    await first;

    expect(posted).toEqual([]);
  });
});
