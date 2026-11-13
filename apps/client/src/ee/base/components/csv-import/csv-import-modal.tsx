import { useCallback, useId, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Progress,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconAlertCircle,
  IconFileTypeCsv,
  IconReplace,
  IconTableImport,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBase } from "@/ee/base/types/base.types";
import { useCsvImport, CsvImportSession } from "@/ee/base/hooks/use-csv-import";
import {
  CSV_DELIMITERS,
  CSV_ENCODINGS,
  PREVIEW_ROW_COUNT,
} from "@/ee/base/csv-import/csv-import.constants";
import type { CsvDelimiter } from "@/ee/base/csv-import/csv-import.types";
import { CsvImportDropzone } from "@/ee/base/components/csv-import/csv-import-dropzone";
import { CsvImportPreview } from "@/ee/base/components/csv-import/csv-import-preview";
import { formatBytes } from "@/lib";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportModalProps = {
  base: IBase;
  opened: boolean;
  onClose: () => void;
};

export default function CsvImportModal({ base, opened, onClose }: CsvImportModalProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const session = useCsvImport(base, onClose);
  // a column menu takes Escape and outside clicks first
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const picking = !session.file;
  const importing =
    session.progress?.phase === "converting" || session.progress?.phase === "uploading";

  // closing is the explicit way to stop an import in flight
  const close = () => {
    session.cancelImport();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      closeOnEscape={!importing && !columnMenuOpen}
      closeOnClickOutside={!importing && !columnMenuOpen}
      title={t("Import CSV")}
      size={picking ? "lg" : 1080}
      fullScreen={isMobile}
      padding="lg"
      yOffset="6vh"
      styles={{
        title: { fontWeight: 600 },
        // only the body scrolls, so the header can't move with the scroll or its bounce
        content: { display: "flex", flexDirection: "column", overflow: "hidden" },
        header: { position: "static", flex: "none" },
        body: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
        },
      }}
    >
      {picking ? (
        <Stack gap="sm">
          <CsvImportDropzone onFile={session.selectFile} />
          {session.error && <ErrorAlert message={session.error} />}
        </Stack>
      ) : (
        <CsvImportBody
          session={session}
          importing={importing}
          onCancel={close}
          onMenuOpenChange={setColumnMenuOpen}
        />
      )}
    </Modal>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} role="alert">
      {message}
    </Alert>
  );
}

function CsvImportBody({
  session,
  importing,
  onCancel,
  onMenuOpenChange,
}: {
  session: CsvImportSession;
  importing: boolean;
  onCancel: () => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { file, loaded, progress, loadOptions } = session;
  const reading = progress?.phase === "reading";
  const delimiterId = useId();
  const encodingId = useId();

  const changeDelimiter = useCallback(
    (value: string | null) => {
      if (value) session.changeLoadOptions({ delimiter: value as CsvDelimiter });
    },
    [session],
  );
  const changeEncoding = useCallback(
    (value: string | null) => {
      if (value) session.changeLoadOptions({ encoding: value });
    },
    [session],
  );

  const meta =
    loaded && !reading
      ? [
          t("{{count}} rows", { count: loaded.rowCount }),
          t("{{count}} columns", { count: loaded.headers.length }),
          formatBytes(file.size),
        ].join(" · ")
      : formatBytes(file.size);
  const includedCount = session.plans.filter((plan) => plan.include).length;
  const settingsDisabled = importing || reading;

  const toggleAll = () => {
    const include = includedCount < session.plans.length;
    for (const plan of session.plans) session.updatePlan(plan.index, { include });
  };

  return (
    <Stack gap="lg" className={classes.importBody}>
      <section className={classes.fileCard} aria-label={t("File")}>
        <div className={classes.fileCardMain}>
          <div className={classes.fileTile} aria-hidden>
            <IconFileTypeCsv size={22} stroke={1.6} />
          </div>
          <div className={classes.fileText}>
            <div className={classes.fileName} title={file.name}>
              {file.name}
            </div>
            <div className={classes.fileMeta}>{meta}</div>
          </div>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconReplace size={14} />}
            onClick={session.resetFile}
            disabled={importing}
          >
            {t("Choose another file")}
          </Button>
        </div>
        <div className={classes.fileSettings}>
          <Switch
            size="xs"
            label={t("First row is a header")}
            checked={loadOptions.hasHeader}
            onChange={(event) =>
              session.changeLoadOptions({ hasHeader: event.currentTarget.checked })
            }
            disabled={settingsDisabled}
            classNames={{ label: classes.settingLabel }}
          />
          <div className={classes.setting}>
            <label htmlFor={delimiterId} className={classes.settingLabel}>
              {t("Delimiter")}
            </label>
            <Select
              id={delimiterId}
              size="xs"
              data={CSV_DELIMITERS.map((d) => ({ value: d.value, label: t(d.label) }))}
              value={loadOptions.delimiter ?? loaded?.delimiter ?? null}
              onChange={changeDelimiter}
              allowDeselect={false}
              checkIconPosition="right"
              disabled={settingsDisabled}
              w={128}
              comboboxProps={{ withinPortal: true }}
            />
          </div>
          <div className={classes.setting}>
            <label htmlFor={encodingId} className={classes.settingLabel}>
              {t("Encoding")}
            </label>
            <Select
              id={encodingId}
              size="xs"
              data={CSV_ENCODINGS.map((e) => ({ value: e.value, label: t(e.label) }))}
              value={loadOptions.encoding ?? loaded?.encoding ?? null}
              onChange={changeEncoding}
              allowDeselect={false}
              checkIconPosition="right"
              disabled={settingsDisabled}
              w={220}
              comboboxProps={{ withinPortal: true }}
            />
          </div>
        </div>
      </section>

      {reading || !loaded ? (
        reading ? <ReadingSkeleton fraction={progress?.fraction ?? 0} /> : null
      ) : (
        <Stack gap="xs" className={classes.columnsSection}>
          <div className={classes.sectionHeader}>
            <div>
              <Text component="h3" className={classes.sectionTitle}>
                {t("Columns")}
              </Text>
              <Text className={classes.sectionHint}>
                {t("Click a column to rename it, change its type or skip it.")}
              </Text>
            </div>
            <Group gap={8} wrap="nowrap">
              <Text className={classes.sectionMeta}>
                {t("{{included}} of {{total}} included", {
                  included: includedCount,
                  total: session.plans.length,
                })}
              </Text>
              <Checkbox
                size="xs"
                variant="outline"
                checked={includedCount === session.plans.length}
                indeterminate={includedCount > 0 && includedCount < session.plans.length}
                onChange={toggleAll}
                disabled={importing}
                aria-label={t("Import all columns")}
              />
            </Group>
          </div>
          <CsvImportPreview
            plans={session.plans}
            profiles={loaded.profiles}
            rows={loaded.previewRows}
            properties={Array.from(session.propertiesById.values())}
            propertiesById={session.propertiesById}
            disabled={importing}
            onPlanChange={session.updatePlan}
            onMenuOpenChange={onMenuOpenChange}
          />
          {loaded.rowCount > PREVIEW_ROW_COUNT && (
            <Text className={classes.sectionHint}>
              {t("First {{count}} rows", { count: PREVIEW_ROW_COUNT })}
            </Text>
          )}
        </Stack>
      )}

      <ImportFooter
        session={session}
        importing={importing}
        disabled={reading || !loaded}
        onCancel={onCancel}
      />
    </Stack>
  );
}

function ReadingSkeleton({ fraction }: { fraction: number }) {
  const { t } = useTranslation();
  return (
    <Stack gap={0} role="status" aria-busy="true" aria-label={t("Reading file")}>
      <Text size="xs" c="dimmed" mb="xs">
        {t("Reading file… {{percent}}%", { percent: Math.round(fraction * 100) })}
      </Text>
      <div className={classes.skeletonTable}>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={row} className={classes.skeletonRow} data-head={row === 0 || undefined}>
            <Skeleton height={8} width={12} radius="xl" />
            {Array.from({ length: 4 }, (_, cell) => (
              <Skeleton
                key={cell}
                height={row === 0 ? 10 : 8}
                width={`${45 + ((row * 17 + cell * 29) % 45)}%`}
                radius="xl"
              />
            ))}
          </div>
        ))}
      </div>
    </Stack>
  );
}

function ImportFooter({
  session,
  importing,
  disabled,
  onCancel,
}: {
  session: CsvImportSession;
  importing: boolean;
  disabled: boolean;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { loaded, progress, included } = session;
  const newCount = included.filter((plan) => plan.target.kind === "new").length;
  const rowCount = loaded?.rowCount ?? 0;

  let status = "";
  if (progress?.phase === "converting") status = t("Preparing rows…");
  else if (progress?.phase === "uploading") status = t("Uploading…");
  else if (included.length === 0) status = t("Choose at least one column to import.");
  else if (newCount > 0) status = t("{{count}} new properties will be created.", { count: newCount });

  const problem = session.error ?? session.blockingProblem;

  return (
    <Stack gap="xs" className={classes.footer}>
      {problem && !importing && <ErrorAlert message={problem} />}
      {importing && (
        <Progress
          value={Math.round((progress?.fraction ?? 0) * 100)}
          size="sm"
          animated
          aria-label={status}
        />
      )}
      <div className={classes.footerRow}>
        <Text aria-live="polite" className={classes.footerStatus}>
          {disabled ? "" : status}
        </Text>
        <div className={classes.footerActions}>
          <Button variant="default" onClick={onCancel}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={session.startImport}
            loading={importing}
            disabled={disabled || included.length === 0 || !!session.blockingProblem}
            leftSection={<IconTableImport size={16} />}
          >
            {rowCount > 0
              ? t("Import {{count}} rows", {
                  count: rowCount,
                  formatted: rowCount.toLocaleString(i18n.language),
                })
              : t("Import")}
          </Button>
        </div>
      </div>
    </Stack>
  );
}
