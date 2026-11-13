import { useId, useMemo } from "react";
import { Checkbox, Group, Select, Table, Text } from "@mantine/core";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";
import { IBaseProperty, SelectTypeOptions } from "@/ee/base/types/base.types";
import {
  CSV_IMPORT_PROPERTY_TYPES,
  MAX_IMPORT_CHOICES,
  MAX_LONG_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
} from "@/ee/base/csv-import/csv-import.constants";
import {
  columnLetter,
  defaultTypeOptions,
  isImportableProperty,
  planNameTaken,
  planTargetType,
  takenPropertyNames,
  uniquePropertyName,
} from "@/ee/base/csv-import/csv-import-mapping";
import type {
  CsvColumnPlan,
  CsvColumnProfile,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";
import { CsvImportTarget, TypeIcon } from "./csv-import-target";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportColumnsProps = {
  plans: CsvColumnPlan[];
  profiles: CsvColumnProfile[];
  properties: IBaseProperty[];
  propertiesById: Map<string, IBaseProperty>;
  disabled: boolean;
  onPlanChange: (index: number, patch: Partial<CsvColumnPlan>) => void;
};

export function CsvImportColumns({
  plans,
  profiles,
  properties,
  propertiesById,
  disabled,
  onPlanChange,
}: CsvImportColumnsProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const importable = useMemo(() => properties.filter(isImportableProperty), [properties]);
  const includedCount = plans.filter((plan) => plan.include).length;

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

  const typeData = useMemo(
    () =>
      CSV_IMPORT_PROPERTY_TYPES.map((type) => ({
        value: type,
        label: t(PROPERTY_TYPE_REGISTRY[type].labelKey),
      })),
    [t],
  );

  const toggleAll = () => {
    const include = includedCount < plans.length;
    for (const plan of plans) onPlanChange(plan.index, { include });
  };

  return (
    <Table className={classes.columnsTable} verticalSpacing={6} horizontalSpacing="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={36}>
            <Checkbox
              size="xs"
              checked={includedCount === plans.length}
              indeterminate={includedCount > 0 && includedCount < plans.length}
              onChange={toggleAll}
              disabled={disabled}
              aria-label={t("Import all columns")}
            />
          </Table.Th>
          <Table.Th>{t("Column in file")}</Table.Th>
          <Table.Th w={28} />
          <Table.Th>{t("Import as")}</Table.Th>
          <Table.Th w="26%">{t("Type")}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {plans.map((plan) => {
          const profile = profiles[plan.index];
          const targetType = planTargetType(plan, propertiesById);
          const usedElsewhere = new Set(
            plans
              .filter((p) => p.index !== plan.index && p.include && p.target.kind === "existing")
              .map((p) => (p.target.kind === "existing" ? p.target.propertyId : "")),
          );
          const selectNew = () => {
            const type = profile.suggestion.type;
            onPlanChange(plan.index, {
              target: { kind: "new", type },
              name: uniquePropertyName(
                plan.header,
                takenPropertyNames(plans, properties, plan.index),
              ),
              typeOptions: defaultTypeOptions(type, profile),
            });
          };

          const selectExisting = (propertyId: string) => {
            onPlanChange(plan.index, {
              target: { kind: "existing", propertyId },
              typeOptions: undefined,
            });
          };

          const changeType = (value: string | null) => {
            if (!value || plan.target.kind !== "new") return;
            const type = value as CsvImportPropertyType;
            onPlanChange(plan.index, {
              target: { kind: "new", type },
              typeOptions: defaultTypeOptions(type, profile),
            });
          };

          const property =
            plan.target.kind === "existing" ? propertiesById.get(plan.target.propertyId) : undefined;
          const existingChoices =
            (property?.typeOptions as SelectTypeOptions | undefined)?.choices?.length ?? 0;
          const warning =
            targetType && plan.include
              ? columnWarning(t, targetType, profile, existingChoices)
              : null;
          const samples = profile.samples.join(", ");
          const warningId = `${idPrefix}-warning-${plan.index}`;
          const columnLabel = repeatedHeaders.has(plan.header.toLowerCase())
            ? t("{{name}} (column {{number}})", { name: plan.header, number: plan.index + 1 })
            : plan.header;

          return (
            <Table.Tr
              key={plan.index}
              className={classes.columnRow}
              data-skipped={!plan.include || undefined}
            >
              <Table.Td>
                <div className={classes.cellCenter}>
                  <Checkbox
                    size="xs"
                    checked={plan.include}
                    disabled={disabled}
                    onChange={(event) =>
                      onPlanChange(plan.index, { include: event.currentTarget.checked })
                    }
                    aria-label={t("Import column {{name}}", { name: columnLabel })}
                  />
                </div>
              </Table.Td>
              <Table.Td>
                <div className={classes.source}>
                  <span className={classes.letter} aria-hidden>
                    {columnLetter(plan.index)}
                  </span>
                  <div className={classes.sourceText}>
                    <div className={classes.columnName} title={plan.header}>
                      {plan.header}
                    </div>
                    <div className={classes.columnSamples} title={samples}>
                      {samples || t("Empty")}
                    </div>
                  </div>
                </div>
              </Table.Td>
              <Table.Td>
                <div className={classes.cellCenter}>
                  <IconArrowRight size={14} className={classes.arrow} aria-hidden />
                </div>
              </Table.Td>
              {!plan.include ? (
                <Table.Td colSpan={2}>
                  <div className={`${classes.cellCenter} ${classes.notImported}`}>
                    {t("Not imported")}
                  </div>
                </Table.Td>
              ) : (
                <>
              <Table.Td>
                <CsvImportTarget
                  plan={plan}
                  columnLabel={columnLabel}
                  importable={importable}
                  propertiesById={propertiesById}
                  usedElsewhere={usedElsewhere}
                  nameTaken={planNameTaken(plans, properties, plan)}
                  disabled={disabled}
                  onSelectNew={selectNew}
                  onSelectExisting={selectExisting}
                  onRename={(name) => onPlanChange(plan.index, { name })}
                />
              </Table.Td>
              <Table.Td>
                {plan.target.kind === "new" ? (
                  <Select
                    size="xs"
                    data={typeData}
                    value={plan.target.type}
                    onChange={changeType}
                    allowDeselect={false}
                    disabled={disabled}
                    leftSection={<TypeIcon type={plan.target.type} />}
                    renderOption={({ option }) => (
                      <Group gap={8} wrap="nowrap">
                        <TypeIcon type={option.value as CsvImportPropertyType} />
                        <Text size="xs">{option.label}</Text>
                      </Group>
                    )}
                    comboboxProps={{ withinPortal: true }}
                    aria-label={t("Property type for column {{name}}", { name: columnLabel })}
                    aria-describedby={warning ? warningId : undefined}
                  />
                ) : targetType ? (
                  <div className={`${classes.cellCenter} ${classes.typeLabel}`}>
                    <TypeIcon type={targetType} />
                    {t(PROPERTY_TYPE_REGISTRY[targetType].labelKey)}
                  </div>
                ) : null}
                {warning && (
                  <div id={warningId} className={classes.warningText}>
                    <IconAlertTriangle size={13} aria-hidden />
                    <span>{warning}</span>
                  </div>
                )}
              </Table.Td>
                </>
              )}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

// the choice count is an upper bound: values matching existing choices are counted twice
function columnWarning(
  t: (key: string, options?: Record<string, unknown>) => string,
  type: CsvImportPropertyType,
  profile: CsvColumnProfile,
  existingChoices: number,
): string | null {
  const count = profile.issues[type] ?? 0;
  const label = t(PROPERTY_TYPE_REGISTRY[type].labelKey);

  if (type === "text" || type === "longText") {
    if (count === 0) return null;
    return t("{{count}} values are longer than {{max}} characters and will be shortened.", {
      count,
      max: type === "text" ? MAX_TEXT_LENGTH : MAX_LONG_TEXT_LENGTH,
    });
  }
  if (type === "select" || type === "status" || type === "multiSelect") {
    const distinct = type === "multiSelect" ? profile.distinctTokenCount : profile.distinctCount;
    if (existingChoices + distinct > MAX_IMPORT_CHOICES) {
      return t("A property can have up to {{max}} options. Values beyond that will be left empty.", {
        max: MAX_IMPORT_CHOICES,
      });
    }
  }
  if (count === 0) return null;
  return t("{{count}} values can't be read as {{type}} and will be left empty.", {
    count,
    type: label,
  });
}
