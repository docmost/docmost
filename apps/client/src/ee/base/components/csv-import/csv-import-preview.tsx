import { useMemo } from "react";
import { Checkbox, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";
import {
  Choice,
  DateTypeOptions,
  IBaseProperty,
  NumberTypeOptions,
} from "@/ee/base/types/base.types";
import { convertCsvValue } from "@/ee/base/csv-import/csv-import-convert";
import { previewChoiceColors } from "@/ee/base/csv-import/csv-import-choices";
import { planTargetType } from "@/ee/base/csv-import/csv-import-mapping";
import type {
  CsvColumnPlan,
  CsvConvertResult,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";
import { formatDateDisplay, formatNumber } from "@/ee/base/formatters/cell-formatters";
import { ChoiceBadge } from "@/ee/base/components/cells/choice-badge";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportPreviewProps = {
  plans: CsvColumnPlan[];
  rows: string[][];
  propertiesById: Map<string, IBaseProperty>;
};

type PreviewColumn = {
  plan: CsvColumnPlan;
  type: CsvImportPropertyType;
  name: string;
  typeOptions: Record<string, unknown> | undefined;
  results: CsvConvertResult[];
  colors: Map<string, string>;
};

const CHOICE_TYPES = new Set<CsvImportPropertyType>(["select", "status", "multiSelect"]);

export function CsvImportPreview({ plans, rows, propertiesById }: CsvImportPreviewProps) {
  const { t } = useTranslation();

  const columns = useMemo<PreviewColumn[]>(
    () =>
      plans.flatMap((plan) => {
        const type = planTargetType(plan, propertiesById);
        if (!plan.include || !type) return [];
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
        return [{ plan, type, name: property?.name ?? plan.name, typeOptions, results, colors }];
      }),
    [plans, propertiesById, rows],
  );

  return (
    <div className={classes.previewScroll}>
      <table className={classes.previewTable}>
        <thead>
          <tr>
            {columns.map(({ plan, type, name }) => {
              const Icon = PROPERTY_TYPE_REGISTRY[type].icon;
              return (
                <th key={plan.index} scope="col">
                  <span className={classes.previewHeader} title={name}>
                    <Icon size={14} className={classes.previewHeaderIcon} aria-hidden />
                    {name}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
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
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
