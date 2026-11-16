import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isCancel } from "axios";
import { notifications } from "@mantine/notifications";
import { IBase, IBaseProperty } from "@/ee/base/types/base.types";
import {
  createCsvImportWorker,
  CsvImportWorkerClient,
  CsvWorkerSupersededError,
} from "@/ee/base/csv-import/csv-import-worker-client";
import {
  applyPlanChange,
  buildConvertColumns,
  buildImportSpec,
  buildInitialPlans,
  findPlanConflict,
  includedPlans,
  reconcilePlans,
} from "@/ee/base/csv-import/csv-import-mapping";
import {
  CSV_EXTENSIONS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  SPREADSHEET_EXTENSIONS,
} from "@/ee/base/csv-import/csv-import.constants";
import type {
  CsvColumnPlan,
  CsvLoadOptions,
  CsvLoadResult,
} from "@/ee/base/csv-import/csv-import.types";
import { importBaseCsv } from "@/ee/base/services/base-service";
import { trackBaseImport } from "@/ee/base/csv-import/track-base-import";
import { getFileImportSizeLimit } from "@/lib/config.ts";
import { formatBytes } from "@/lib";
import { getApiErrorMessage } from "@/lib/api-error";

export type CsvImportProgress = {
  phase: "reading" | "converting" | "uploading";
  fraction: number;
};

const DEFAULT_LOAD_OPTIONS: CsvLoadOptions = {
  encoding: null,
  delimiter: null,
  hasHeader: true,
};

const MAX_FILE_NAME_LENGTH = 255;

export function useCsvImport(base: IBase, onImported: () => void) {
  const { t, i18n } = useTranslation();
  const workerRef = useRef<CsvImportWorkerClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const importingRef = useRef(false);
  const mountedRef = useRef(true);
  const [file, setFile] = useState<File | null>(null);
  const [loadOptions, setLoadOptions] = useState<CsvLoadOptions>(DEFAULT_LOAD_OPTIONS);
  const [loaded, setLoaded] = useState<CsvLoadResult | null>(null);
  const [plans, setPlans] = useState<CsvColumnPlan[]>([]);
  const [progress, setProgress] = useState<CsvImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const propertiesById = useMemo(
    () => new Map<string, IBaseProperty>(base.properties.map((p) => [p.id, p])),
    [base.properties],
  );

  const releaseWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  // an import in flight outlives the dialog: it finishes and reports through its toast
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (!importingRef.current) releaseWorker();
    };
  }, [releaseWorker]);

  useEffect(() => {
    if (!loaded) return;
    setPlans((current) => reconcilePlans(current, base.properties, loaded.profiles));
  }, [base.properties, loaded]);

  const load = useCallback(
    async (nextFile: File, options: CsvLoadOptions) => {
      const worker = (workerRef.current ??= createCsvImportWorker());
      setError(null);
      setProgress({ phase: "reading", fraction: 0 });
      try {
        const result = await worker.load(nextFile, options, (p) =>
          setProgress({ phase: "reading", fraction: p.total ? p.processed / p.total : 0 }),
        );
        const headers = result.headers.map(
          (header, i) => header || t("Column {{number}}", { number: i + 1 }),
        );
        setLoaded({ ...result, headers });
        setPlans(buildInitialPlans(headers, result.profiles, base.properties));
        setProgress(null);
      } catch (err) {
        if (err instanceof CsvWorkerSupersededError) return;
        setLoaded(null);
        setPlans([]);
        setProgress(null);
        setError(t("This file could not be read. Make sure it is a CSV file."));
      }
    },
    [base.properties, t],
  );

  const selectFile = useCallback(
    (nextFile: File | null) => {
      if (!nextFile) return;
      const extension = nextFile.name.split(".").pop()?.toLowerCase() ?? "";
      if (SPREADSHEET_EXTENSIONS.has(extension)) {
        setError(t("Spreadsheet files can't be imported directly. Save the sheet as CSV and try again."));
        return;
      }
      if (!CSV_EXTENSIONS.has(extension) && !nextFile.type.startsWith("text/")) {
        setError(t("Choose a CSV file."));
        return;
      }
      const limit = getFileImportSizeLimit();
      if (nextFile.size > limit) {
        setError(t("File exceeds the {{limit}} import limit", { limit: formatBytes(limit) }));
        return;
      }
      setFile(nextFile);
      setLoadOptions(DEFAULT_LOAD_OPTIONS);
      setLoaded(null);
      void load(nextFile, DEFAULT_LOAD_OPTIONS);
    },
    [load, t],
  );

  const changeLoadOptions = useCallback(
    (patch: Partial<CsvLoadOptions>) => {
      if (!file) return;
      const next = { ...loadOptions, ...patch };
      setLoadOptions(next);
      void load(file, next);
    },
    [file, load, loadOptions],
  );

  // dropping the worker also drops a read still in progress
  const resetFile = useCallback(() => {
    releaseWorker();
    setFile(null);
    setLoaded(null);
    setPlans([]);
    setProgress(null);
    setError(null);
  }, [releaseWorker]);

  const cancelImport = useCallback(() => {
    abortRef.current?.abort();
    if (importingRef.current) releaseWorker();
  }, [releaseWorker]);

  const updatePlan = useCallback(
    (index: number, patch: Partial<CsvColumnPlan>) => {
      if (!loaded) return;
      setPlans((current) =>
        applyPlanChange(current, index, patch, base.properties, loaded.profiles),
      );
    },
    [base.properties, loaded],
  );

  const included = useMemo(() => includedPlans(plans, propertiesById), [plans, propertiesById]);

  const blockingProblem = useMemo(() => {
    if (!loaded) return null;
    if (loaded.rowCount === 0) return t("This file has no rows to import.");
    if (loaded.rowCount > MAX_IMPORT_ROWS) {
      return t("You can import up to {{max}} rows at a time.", {
        max: MAX_IMPORT_ROWS.toLocaleString(i18n.language),
      });
    }
    if (included.length > MAX_IMPORT_COLUMNS) {
      return t("You can import up to {{max}} columns at a time.", { max: MAX_IMPORT_COLUMNS });
    }
    const conflict = findPlanConflict(plans, propertiesById);
    if (conflict?.kind === "property") {
      return t("More than one column is set to {{name}}.", { name: conflict.name });
    }
    if (conflict?.kind === "name") {
      return t("More than one property would be named {{name}}.", { name: conflict.name });
    }
    return null;
  }, [i18n.language, included.length, loaded, plans, propertiesById, t]);

  const startImport = useCallback(async () => {
    const worker = workerRef.current;
    if (!worker || !file || !loaded || blockingProblem || included.length === 0) return;
    // once the dialog is gone, problems go to a toast
    const fail = (message: string) => {
      if (!mountedRef.current) {
        notifications.show({ color: "red", title: t("Import failed"), message });
        return;
      }
      setProgress(null);
      setError(message);
    };
    importingRef.current = true;
    setError(null);
    setProgress({ phase: "converting", fraction: 0 });
    try {
      const converted = await worker.convert(buildConvertColumns(plans, propertiesById), (p) =>
        setProgress({ phase: "converting", fraction: p.total ? p.processed / p.total : 0 }),
      );
      if (converted.rowCount === 0) {
        fail(t("The selected columns have no values to import."));
        return;
      }
      const limit = getFileImportSizeLimit();
      if (converted.blob.size > limit) {
        fail(
          t(
            "The prepared data is larger than the {{limit}} import limit. Try importing fewer columns.",
            { limit: formatBytes(limit) },
          ),
        );
        return;
      }

      const spec = buildImportSpec(
        plans,
        propertiesById,
        file.name.slice(0, MAX_FILE_NAME_LENGTH),
        converted,
      );
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ phase: "uploading", fraction: 0 });
      const task = await importBaseCsv(
        { pageId: base.id, spec, rows: converted.blob },
        {
          signal: controller.signal,
          onUploadProgress: (fraction) => {
            // the server has the whole file and will run it, so cancelling can't stop it now
            if (fraction >= 1) abortRef.current = null;
            setProgress({ phase: "uploading", fraction });
          },
        },
      );
      trackBaseImport({ fileTaskId: task.id, pageId: base.id, totalRows: converted.rowCount });
      onImported();
    } catch (err) {
      if (err instanceof CsvWorkerSupersededError || isCancel(err)) return;
      fail(getApiErrorMessage(err, t("Failed to import CSV")));
    } finally {
      importingRef.current = false;
      abortRef.current = null;
      if (!mountedRef.current) releaseWorker();
    }
  }, [
    base.id,
    blockingProblem,
    file,
    included.length,
    loaded,
    onImported,
    plans,
    propertiesById,
    releaseWorker,
    t,
  ]);

  return {
    file,
    loadOptions,
    loaded,
    plans,
    included,
    propertiesById,
    progress,
    error,
    blockingProblem,
    selectFile,
    changeLoadOptions,
    resetFile,
    cancelImport,
    updatePlan,
    startImport,
  };
}

export type CsvImportSession = ReturnType<typeof useCsvImport>;
