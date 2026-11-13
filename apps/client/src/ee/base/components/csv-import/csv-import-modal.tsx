import { useCallback } from "react";
import {
  Alert,
  Button,
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
import { IconAlertCircle, IconFileTypeCsv } from "@tabler/icons-react";
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
import { CsvImportColumns } from "@/ee/base/components/csv-import/csv-import-columns";
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
      closeOnEscape={!importing}
      closeOnClickOutside={!importing}
      title={t("Import CSV")}
      size={picking ? "lg" : 1080}
      fullScreen={isMobile}
      padding="lg"
      yOffset="6vh"
      styles={{ title: { fontWeight: 600 } }}
    >
      {picking ? (
        <Stack gap="sm">
          <CsvImportDropzone onFile={session.selectFile} />
          {session.error && <ErrorAlert message={session.error} />}
        </Stack>
      ) : (
        <CsvImportBody session={session} importing={importing} onCancel={close} />
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
}: {
  session: CsvImportSession;
  importing: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { file, loaded, progress, loadOptions } = session;
  const reading = progress?.phase === "reading";

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

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <div className={classes.fileBar}>
          <IconFileTypeCsv size={20} className={classes.fileIcon} aria-hidden />
          <Text size="sm" fw={500} truncate>
            {file.name}
          </Text>
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {loaded && !reading
              ? `${t("{{count}} rows", { count: loaded.rowCount })} · ${t("{{count}} columns", {
                  count: loaded.headers.length,
                })}`
              : formatBytes(file.size)}
          </Text>
        </div>
        <Button variant="subtle" size="xs" onClick={session.resetFile} disabled={importing}>
          {t("Choose another file")}
        </Button>
      </Group>

      <Group gap="lg" align="flex-end" wrap="wrap">
        <Switch
          size="sm"
          label={t("First row is a header")}
          checked={loadOptions.hasHeader}
          onChange={(event) =>
            session.changeLoadOptions({ hasHeader: event.currentTarget.checked })
          }
          disabled={importing || reading}
        />
        <Select
          size="xs"
          label={t("Delimiter")}
          data={CSV_DELIMITERS.map((d) => ({ value: d.value, label: t(d.label) }))}
          value={loadOptions.delimiter ?? loaded?.delimiter ?? null}
          onChange={changeDelimiter}
          allowDeselect={false}
          disabled={importing || reading}
          w={140}
        />
        <Select
          size="xs"
          label={t("Encoding")}
          data={CSV_ENCODINGS.map((e) => ({ value: e.value, label: t(e.label) }))}
          value={loadOptions.encoding ?? loaded?.encoding ?? null}
          onChange={changeEncoding}
          allowDeselect={false}
          disabled={importing || reading}
          w={230}
          comboboxProps={{ withinPortal: true }}
        />
      </Group>

      {reading || !loaded ? (
        reading ? <ReadingSkeleton fraction={progress?.fraction ?? 0} /> : null
      ) : (
        <>
          <Stack gap={6}>
            <Text component="h3" className={classes.sectionTitle}>
              {t("Columns")}
            </Text>
            <CsvImportColumns
              plans={session.plans}
              profiles={loaded.profiles}
              properties={Array.from(session.propertiesById.values())}
              propertiesById={session.propertiesById}
              disabled={importing}
              onPlanChange={session.updatePlan}
            />
          </Stack>
          {session.included.length > 0 && loaded.previewRows.length > 0 && (
            <Stack gap={6}>
              <Group gap={8} align="baseline">
                <Text component="h3" className={classes.sectionTitle}>
                  {t("Preview")}
                </Text>
                <Text size="xs" c="dimmed">
                  {t("First {{count}} rows", {
                    count: Math.min(PREVIEW_ROW_COUNT, loaded.previewRows.length),
                  })}
                </Text>
              </Group>
              <CsvImportPreview
                plans={session.plans}
                rows={loaded.previewRows}
                propertiesById={session.propertiesById}
              />
            </Stack>
          )}
        </>
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
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={classes.skeletonRow}>
          <Skeleton height={16} width={16} radius="sm" />
          <Stack gap={6}>
            <Skeleton height={10} width={`${50 + ((i * 17) % 35)}%`} radius="xl" />
            <Skeleton height={8} width={`${35 + ((i * 23) % 40)}%`} radius="xl" />
          </Stack>
          <Skeleton height={10} width={14} radius="xl" />
          <Skeleton height={28} radius="sm" />
          <Skeleton height={28} radius="sm" />
        </div>
      ))}
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
        <Text size="xs" c="dimmed" aria-live="polite" className={classes.footerStatus}>
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
