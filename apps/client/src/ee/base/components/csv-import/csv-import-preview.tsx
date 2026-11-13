import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox, Tooltip } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";
import {
  Choice,
  DateTypeOptions,
  IBaseProperty,
  NumberTypeOptions,
  SelectTypeOptions,
} from "@/ee/base/types/base.types";
import { convertCsvValue } from "@/ee/base/csv-import/csv-import-convert";
import { previewChoiceColors } from "@/ee/base/csv-import/csv-import-choices";
import { isImportableProperty, planTargetType } from "@/ee/base/csv-import/csv-import-mapping";
import { columnWarning } from "@/ee/base/csv-import/csv-import-warnings";
import type {
  CsvColumnPlan,
  CsvColumnProfile,
  CsvConvertResult,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";
import { formatDateDisplay, formatNumber } from "@/ee/base/formatters/cell-formatters";
import { ChoiceBadge } from "@/ee/base/components/cells/choice-badge";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { CsvImportColumnHeader } from "./csv-import-column-header";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportPreviewProps = {
  plans: CsvColumnPlan[];
  profiles: CsvColumnProfile[];
  rows: string[][];
  properties: IBaseProperty[];
  propertiesById: Map<string, IBaseProperty>;
  disabled: boolean;
  onPlanChange: (index: number, patch: Partial<CsvColumnPlan>) => void;
  onMenuOpenChange: (open: boolean) => void;
};

type SkippedColumn = { plan: CsvColumnPlan; included: false };

type PreviewColumn = {
  plan: CsvColumnPlan;
  included: true;
  type: CsvImportPropertyType;
  name: string;
  typeOptions: Record<string, unknown> | undefined;
  results: CsvConvertResult[];
  colors: Map<string, string>;
  warning: string | null;
};

const CHOICE_TYPES = new Set<CsvImportPropertyType>(["select", "status", "multiSelect"]);

// the preview is also where columns are set up: each header opens that column's settings
export function CsvImportPreview({
  plans,
  profiles,
  rows,
  properties,
  propertiesById,
  disabled,
  onPlanChange,
  onMenuOpenChange,
}: CsvImportPreviewProps) {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headerRefs = useRef(new Map<number, HTMLTableCellElement>());
  const importable = useMemo(() => properties.filter(isImportableProperty), [properties]);

  useEffect(() => {
    onMenuOpenChange(openIndex !== null);
  }, [openIndex, onMenuOpenChange]);
  useEffect(() => () => onMenuOpenChange(false), [onMenuOpenChange]);

  // the dialog ignores Escape while a menu is open, so the first Escape only closes the menu
  useWindowEvent(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || openIndex === null) return;
      // an open type list inside the menu closes first
      const target = event.target as HTMLElement | null;
      if (target?.getAttribute?.("data-mantine-stop-propagation") === "true") return;
      setOpenIndex(null);
    },
    { capture: true },
  );

  // screen readers need the column number to tell repeated headers apart
  const repeatedHeaders = useMemo(() => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const plan of plans) {
      const key = plan.header.toLowerCase();
      if (seen.has(key)) repeated.add(key);
      seen.add(key);
    }
    return repeated;
  }, [plans]);

  // skipped columns stay in the table, dimmed, so they can be turned back on from their header
  const columns = useMemo(
    () =>
      plans.map((plan): PreviewColumn | SkippedColumn => {
        const type = planTargetType(plan, propertiesById);
        if (!plan.include || !type) return { plan, included: false };
        const property =
          plan.target.kind === "existing" ? propertiesById.get(plan.target.propertyId) : undefined;
        const typeOptions = (property?.typeOptions ?? plan.typeOptions) as
          | Record<string, unknown>
          | undefined;
        const results = rows.map((row) => convertCsvValue(row[plan.index], type, plan.hints));
        const names = results.flatMap((r) =>
          Array.isArray(r.value) ? r.value : typeof r.value === "string" ? [r.value] : [],
        );
        const colors = CHOICE_TYPES.has(type)
          ? previewChoiceColors(
              type as "select" | "status" | "multiSelect",
              ((typeOptions?.choices as Choice[] | undefined) ?? []),
              names,
            )
          : new Map<string, string>();
        const existingChoices =
          (property?.typeOptions as SelectTypeOptions | undefined)?.choices?.length ?? 0;
        const warning = columnWarning(t, type, profiles[plan.index], existingChoices);
        return {
          plan,
          included: true,
          type,
          name: property?.name ?? plan.name,
          typeOptions,
          results,
          colors,
          warning,
        };
      }),
    [plans, profiles, propertiesById, rows, t],
  );

  const warnings = columns.filter(
    (column): column is PreviewColumn => column.included && column.warning !== null,
  );

  const openColumn = (index: number) => {
    headerRefs.current.get(index)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    setOpenIndex(index);
  };

  const columnLabel = (plan: CsvColumnPlan) =>
    repeatedHeaders.has(plan.header.toLowerCase())
      ? t("{{name}} (column {{number}})", { name: plan.header, number: plan.index + 1 })
      : plan.header;

  return (
    <>
      {warnings.length > 0 && (
        <ul className={classes.notes}>
          {warnings.map((column) => (
            <li key={column.plan.index}>
              <button
                type="button"
                className={classes.noteButton}
                onClick={() => openColumn(column.plan.index)}
              >
                <IconAlertTriangle size={13} aria-hidden />
                <span>
                  <strong>{column.name}</strong> {column.warning}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={classes.previewScroll}>
        <table className={classes.previewTable}>
          <thead>
            <tr>
              <th scope="col" className={classes.rowNumber}>
                #
              </th>
              {columns.map((column) => (
                <th
                  key={column.plan.index}
                  scope="col"
                  className={classes.columnHead}
                  ref={(el) => {
                    if (el) headerRefs.current.set(column.plan.index, el);
                    else headerRefs.current.delete(column.plan.index);
                  }}
                >
                  <CsvImportColumnHeader
                    plan={column.plan}
                    profile={profiles[column.plan.index]}
                    plans={plans}
                    properties={properties}
                    importable={importable}
                    propertiesById={propertiesById}
                    columnLabel={columnLabel(column.plan)}
                    warning={column.included ? column.warning : null}
                    opened={openIndex === column.plan.index}
                    disabled={disabled}
                    onOpenChange={(opened) => setOpenIndex(opened ? column.plan.index : null)}
                    onPlanChange={onPlanChange}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className={classes.rowNumber}>{rowIndex + 1}</td>
                {columns.map((column) =>
                  !column.included ? (
                    <td key={column.plan.index} className={classes.skippedCell}>
                      {row[column.plan.index] ?? ""}
                    </td>
                  ) : (
                    <td key={column.plan.index}>
                      <PreviewValue
                        column={column}
                        result={column.results[rowIndex]}
                        raw={row[column.plan.index] ?? ""}
                        invalidLabel={t("Can't be read as {{type}}. It will be left empty.", {
                          type: t(PROPERTY_TYPE_REGISTRY[column.type].labelKey),
                        })}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PreviewValue({
  column,
  result,
  raw,
  invalidLabel,
}: {
  column: PreviewColumn;
  result: CsvConvertResult;
  raw: string;
  invalidLabel: string;
}) {
  if (result.status === "invalid") {
    return (
      <Tooltip label={invalidLabel} withinPortal>
        <span className={classes.invalidValue} aria-label={`${raw}. ${invalidLabel}`}>
          {raw}
        </span>
      </Tooltip>
    );
  }
  const value = result.value;
  if (value === null) return null;

  switch (column.type) {
    case "number":
      return <>{formatNumber(value as number, column.typeOptions as NumberTypeOptions)}</>;
    case "date":
      return <>{formatDateDisplay(value as string, column.typeOptions as DateTypeOptions)}</>;
    case "checkbox":
      return (
        <Checkbox
          size="xs"
          checked={value === true}
          readOnly
          tabIndex={-1}
          aria-label={String(value)}
        />
      );
    case "select":
    case "status":
    case "multiSelect": {
      const names = Array.isArray(value) ? value : [value as string];
      return (
        <div className={classes.previewBadges}>
          {names.map((name) => (
            <ChoiceBadge
              key={name}
              name={name}
              style={choiceColor(column.colors.get(name.trim().toLowerCase()) ?? "gray")}
            />
          ))}
        </div>
      );
    }
    case "person":
      return <>{(value as string[]).join(", ")}</>;
    case "url":
    case "email":
      return <span className={classes.linkValue}>{value as string}</span>;
    case "longText":
      return <>{(value as string).replace(/\s+/g, " ")}</>;
    default:
      return <>{value as string}</>;
  }
}
