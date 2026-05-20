import { Group, NumberInput, Select, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useTranslation } from "react-i18next";
import {
  ExpirationMode,
  PeriodUnit,
} from "@/ee/page-verification/types/page-verification.types";

export const PERIOD_UNIT_DAYS: Record<PeriodUnit, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export const PERIOD_UNIT_MAX_AMOUNT: Record<PeriodUnit, number> = {
  day: 3650,
  week: 520,
  month: 120,
  year: 20,
};

export const PERIOD_AMOUNT_MIN = 1;

export function addDays(days: number, from?: Date): Date {
  const date = from ? new Date(from) : new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatShortDate(date: Date): string {
  const crossesYear = date.getFullYear() !== new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(crossesYear && { year: "numeric" }),
  });
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function toLocalDateString(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pluralizeUnit(
  unit: PeriodUnit,
  amount: number,
  t: (key: string) => string,
): string {
  switch (unit) {
    case "day":
      return amount === 1 ? t("day") : t("days");
    case "week":
      return amount === 1 ? t("week") : t("weeks");
    case "month":
      return amount === 1 ? t("month") : t("months");
    case "year":
      return amount === 1 ? t("year") : t("years");
  }
}

function buildModeOptions(
  t: (key: string) => string,
): { value: ExpirationMode; label: string }[] {
  return [
    { value: "period", label: t("Period") },
    { value: "fixed", label: t("Fixed date") },
    { value: "indefinite", label: t("Indefinitely") },
  ];
}

function buildUnitOptions(
  t: (key: string) => string,
): { value: PeriodUnit; label: string }[] {
  return [
    { value: "day", label: t("Days") },
    { value: "week", label: t("Weeks") },
    { value: "month", label: t("Months") },
    { value: "year", label: t("Years") },
  ];
}

type ExpirationFieldsProps = {
  mode: ExpirationMode;
  periodAmount: number;
  periodUnit: PeriodUnit;
  fixedDate: string;
  onModeChange: (mode: ExpirationMode) => void;
  onPeriodAmountChange: (amount: number) => void;
  onPeriodUnitChange: (unit: PeriodUnit) => void;
  onFixedDateChange: (iso: string) => void;
  baseDate?: Date;
};

export function ExpirationFields({
  mode,
  periodAmount,
  periodUnit,
  fixedDate,
  onModeChange,
  onPeriodAmountChange,
  onPeriodUnitChange,
  onFixedDateChange,
  baseDate,
}: ExpirationFieldsProps) {
  const { t } = useTranslation();
  const modeOptions = buildModeOptions(t);
  const unitOptions = buildUnitOptions(t);

  const unitMax = PERIOD_UNIT_MAX_AMOUNT[periodUnit];

  const handleUnitChange = (nextUnit: PeriodUnit) => {
    const nextMax = PERIOD_UNIT_MAX_AMOUNT[nextUnit];
    if (periodAmount > nextMax) {
      onPeriodAmountChange(nextMax);
    }
    onPeriodUnitChange(nextUnit);
  };

  const amountValid =
    Number.isInteger(periodAmount) &&
    periodAmount >= PERIOD_AMOUNT_MIN &&
    periodAmount <= unitMax;

  const nextDueDate =
    mode === "period" && amountValid
      ? addDays(periodAmount * PERIOD_UNIT_DAYS[periodUnit], baseDate)
      : null;

  const fixedDateObj = fixedDate ? new Date(fixedDate) : null;

  let helperText: string | null = null;
  let helperError = false;
  if (mode === "period" && !amountValid) {
    helperText = t("Maximum is {{max}} {{unit}} for this unit", {
      max: unitMax,
      unit: pluralizeUnit(periodUnit, unitMax, t),
    });
    helperError = true;
  } else if (mode === "period" && nextDueDate && amountValid) {
    helperText = t(
      "Re-verifies every {{amount}} {{unit}} · Next due {{date}}",
      {
        amount: periodAmount,
        unit: pluralizeUnit(periodUnit, periodAmount, t),
        date: formatShortDate(nextDueDate),
      },
    );
  } else if (mode === "fixed" && fixedDateObj) {
    helperText = t(
      "Expires on {{date}}. Re-verifying won't change the deadline.",
      { date: formatLongDate(fixedDateObj) },
    );
  } else if (mode === "indefinite") {
    helperText = t("Never expires. Verifiers can re-verify at any time.");
  }

  return (
    <div>
      <Group align="flex-start" gap="xs" wrap="wrap">
        <Select
          data={modeOptions}
          value={mode}
          onChange={(val) => val && onModeChange(val as ExpirationMode)}
          variant="filled"
          allowDeselect={false}
          style={{ flex: "1 1 140px", minWidth: 140 }}
        />

        {mode === "period" && (
          <Group
            gap="xs"
            wrap="nowrap"
            style={{ flex: "1 1 220px", minWidth: 220 }}
          >
            <NumberInput
              value={periodAmount}
              onChange={(val) => {
                const n =
                  typeof val === "number" ? val : parseInt(String(val), 10);
                if (!Number.isNaN(n)) onPeriodAmountChange(n);
              }}
              min={PERIOD_AMOUNT_MIN}
              max={unitMax}
              clampBehavior="blur"
              variant="filled"
              style={{ flex: "0 0 80px" }}
              hideControls
            />
            <Select
              data={unitOptions}
              value={periodUnit}
              onChange={(val) => val && handleUnitChange(val as PeriodUnit)}
              variant="filled"
              allowDeselect={false}
              style={{ flex: 1, minWidth: 120 }}
            />
          </Group>
        )}

        {mode === "fixed" && (
          <DateInput
            value={fixedDate || undefined}
            onChange={(val) => onFixedDateChange(val ?? "")}
            placeholder={t("Pick a date")}
            variant="filled"
            minDate={addDays(1)}
            clearable
            style={{ flex: "1 1 200px", minWidth: 180 }}
          />
        )}
      </Group>

      {helperText && (
        <Text size="xs" c={helperError ? "red" : "dimmed"} mt={6}>
          {helperText}
        </Text>
      )}
    </div>
  );
}
