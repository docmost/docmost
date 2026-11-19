import { createCsvWorkerHandler } from "@/ee/base/csv-import/csv-import-worker-handler";
import type {
  CsvWorkerRequest,
  CsvWorkerResponse,
} from "@/ee/base/csv-import/csv-import.types";

type WorkerScope = {
  postMessage(message: CsvWorkerResponse): void;
  onmessage: ((event: MessageEvent<CsvWorkerRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;
const handle = createCsvWorkerHandler((message) => scope.postMessage(message));

scope.onmessage = (event) => {
  void handle(event.data);
};
