import { useTranslation } from "react-i18next";
import { IconCalendar, IconCircleFilled } from "@tabler/icons-react";
import { diffDays } from "@docmost/base-formula/client";
import { isHttpUrl } from "@docmost/editor-ext";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { formatNumber } from "@/ee/base/components/cells/cell-number";
import { useDateCellDisplay } from "@/ee/base/hooks/use-date-cell-display";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import { partDayIn } from "@/ee/base/utils/date-cell";
import { dateTypeOptionsOf } from "@/ee/base/utils/date-format";
import type {
  NumberTypeOptions,
  SelectTypeOptions,
} from "@/ee/base/types/base.types";
import type { PageProperty } from "./page-property.types";
import classes from "./page-properties.module.css";

type ValueProps = {
  property: Pick<PageProperty, "name" | "type" | "typeOptions" | "value">;
  compact?: boolean;
  links?: boolean;
};

export function hasPagePropertyValue({ value }: Pick<PageProperty, "value">) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    (!Array.isArray(value) || value.length > 0)
  );
}

function DateValue({ property, compact }: ValueProps) {
  const { i18n } = useTranslation();
  const { timeZone, today } = useViewerDateContext();
  const { cell, text } = useDateCellDisplay(property, property.value);
  const startDay = cell && partDayIn(cell.start, timeZone);
  const relative =
    !compact &&
    startDay &&
    !cell.end &&
    dateTypeOptionsOf(property.typeOptions).dateFormat !== "relative"
      ? new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(
          diffDays(today, startDay),
          "day",
        )
      : null;
  return (
    <span className={classes.dateValue}>
      {compact && <IconCalendar size={14} aria-hidden />}
      <span>
        {text}
        {relative && <span className={classes.muted}> · {relative}</span>}
      </span>
    </span>
  );
}

export function PagePropertyValue({
  property,
  compact = false,
  links = false,
}: ValueProps) {
  const { t } = useTranslation();
  const { type, typeOptions, value } = property;
  if (!hasPagePropertyValue(property))
    return <span className={classes.muted}>{t("No value")}</span>;
  if (type === "date")
    return <DateValue property={property} compact={compact} />;
  if (type === "number") {
    const options = typeOptions as NumberTypeOptions & { unit?: string };
    return (
      <>
        {formatNumber(typeof value === "number" ? value : null, options)}
        {options?.unit && ` ${options.unit}`}
      </>
    );
  }
  if (type === "status" || type === "select" || type === "multiSelect") {
    const ids = Array.isArray(value) ? value : [value];
    const options = typeOptions as SelectTypeOptions;
    const choices =
      options?.choices?.filter((choice) => ids.includes(choice.id)) ?? [];
    return (
      <span className={classes.choices}>
        {choices.map((choice) => (
          <span
            key={choice.id}
            className={type === "status" ? classes.status : classes.choice}
            style={choiceColor(options.disableColors ? "gray" : choice.color)}
          >
            {type === "status" && <IconCircleFilled size={7} aria-hidden />}
            <span>{choice.name}</span>
          </span>
        ))}
      </span>
    );
  }
  if (type === "checkbox") return <>{value ? t("Yes") : t("No")}</>;
  if (links && typeof value === "string") {
    if (type === "email")
      return (
        <a href={`mailto:${value}`} className={classes.textValue}>
          {value}
        </a>
      );
    if (type === "url" && isHttpUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={classes.textValue}
        >
          {value}
        </a>
      );
    }
  }
  return (
    <span className={classes.textValue}>
      {typeof value === "string" ? value : ""}
    </span>
  );
}
