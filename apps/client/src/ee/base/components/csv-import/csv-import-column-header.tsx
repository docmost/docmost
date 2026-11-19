import { useMemo } from "react";
import { Popover, Select, Switch, UnstyledButton } from "@mantine/core";
import { IconAlertTriangle, IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { CSV_IMPORT_PROPERTY_TYPES } from "@/ee/base/csv-import/csv-import.constants";
import {
  columnLetter,
  defaultTypeOptions,
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
import { CsvImportTarget, OptionLabel, TypeIcon } from "./csv-import-target";
import classes from "@/ee/base/styles/csv-import.module.css";

type CsvImportColumnHeaderProps = {
  plan: CsvColumnPlan;
  profile: CsvColumnProfile;
  plans: CsvColumnPlan[];
  properties: IBaseProperty[];
  importable: IBaseProperty[];
  propertiesById: Map<string, IBaseProperty>;
  columnLabel: string;
  warning: string | null;
  opened: boolean;
  disabled: boolean;
  onOpenChange: (opened: boolean) => void;
  onPlanChange: (index: number, patch: Partial<CsvColumnPlan>) => void;
};

// a preview header is its column's menu: imported or not, where it goes and as what type
export function CsvImportColumnHeader({
  plan,
  profile,
  plans,
  properties,
  importable,
  propertiesById,
  columnLabel,
  warning,
  opened,
  disabled,
  onOpenChange,
  onPlanChange,
}: CsvImportColumnHeaderProps) {
  const { t } = useTranslation();
  const type = planTargetType(plan, propertiesById);
  const included = plan.include && type !== null;
  const property =
    plan.target.kind === "existing" ? propertiesById.get(plan.target.propertyId) : undefined;
  const name = property?.name ?? plan.name;
  const nameTaken = planNameTaken(plans, properties, plan);
  const letter = columnLetter(plan.index);
  const Icon = type ? PROPERTY_TYPE_REGISTRY[type].icon : null;
  const settingsLabel = t("Settings for column {{name}}", { name: columnLabel });

  const typeData = useMemo(
    () =>
      CSV_IMPORT_PROPERTY_TYPES.map((value) => ({
        value,
        label: t(PROPERTY_TYPE_REGISTRY[value].labelKey),
      })),
    [t],
  );

  const usedElsewhere = new Set(
    plans.flatMap((p) =>
      p.index !== plan.index && p.include && p.target.kind === "existing"
        ? [p.target.propertyId]
        : [],
    ),
  );

  const selectNew = () => {
    const suggested = profile.suggestion.type;
    onPlanChange(plan.index, {
      target: { kind: "new", type: suggested },
      name: uniquePropertyName(plan.header, takenPropertyNames(plans, properties, plan.index)),
      typeOptions: defaultTypeOptions(suggested, profile),
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
    const next = value as CsvImportPropertyType;
    onPlanChange(plan.index, {
      target: { kind: "new", type: next },
      typeOptions: defaultTypeOptions(next, profile),
    });
  };

  return (
    // Escape is handled by the preview, which lets an open type list close first
    <Popover
      opened={opened}
      onChange={onOpenChange}
      position="bottom-start"
      width={300}
      shadow="md"
      trapFocus
      returnFocus
      closeOnEscape={false}
    >
      <Popover.Target>
        <UnstyledButton
          className={classes.columnHeaderButton}
          data-skipped={!included || undefined}
          disabled={disabled}
          onClick={() => onOpenChange(!opened)}
          aria-label={settingsLabel}
          aria-haspopup="dialog"
          aria-expanded={opened}
        >
          {included && Icon && (
            <Icon size={14} className={classes.previewHeaderIcon} aria-hidden />
          )}
          <span className={classes.columnHeaderName} data-error={nameTaken || undefined}>
            {included ? name : plan.header}
          </span>
          {!included && <span className={classes.skippedLabel}>{t("Not imported")}</span>}
          {included && warning && (
            <IconAlertTriangle size={13} className={classes.columnHeaderWarning} aria-hidden />
          )}
          <span className={classes.letter} aria-hidden>
            {letter}
          </span>
          <IconChevronDown size={12} className={classes.columnHeaderChevron} aria-hidden />
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown className={classes.columnSettings} aria-label={settingsLabel}>
        <div className={classes.columnSettingsHead}>
          <span className={classes.columnSettingsSource}>
            <span className={classes.letter} aria-hidden>
              {letter}
            </span>
            <span className={classes.columnSettingsHeader} title={plan.header}>
              {plan.header}
            </span>
          </span>
          <Switch
            size="xs"
            label={t("Import")}
            labelPosition="left"
            checked={plan.include}
            disabled={disabled}
            onChange={(event) =>
              onPlanChange(plan.index, { include: event.currentTarget.checked })
            }
            aria-label={t("Import column {{name}}", { name: columnLabel })}
          />
        </div>

        {plan.include && (
          <>
            <div className={classes.columnSettingsField}>
              <span className={classes.columnSettingsLabel}>{t("Import as")}</span>
              <CsvImportTarget
                plan={plan}
                columnLabel={columnLabel}
                importable={importable}
                propertiesById={propertiesById}
                usedElsewhere={usedElsewhere}
                nameTaken={nameTaken}
                disabled={disabled}
                onSelectNew={selectNew}
                onSelectExisting={selectExisting}
                onRename={(next) => onPlanChange(plan.index, { name: next })}
              />
            </div>
            <div className={classes.columnSettingsField}>
              <span className={classes.columnSettingsLabel}>{t("Type")}</span>
              {plan.target.kind === "new" ? (
                <Select
                  size="xs"
                  data={typeData}
                  value={plan.target.type}
                  onChange={changeType}
                  allowDeselect={false}
                  disabled={disabled}
                  leftSection={<TypeIcon type={plan.target.type} />}
                  renderOption={({ option, checked }) => (
                    <OptionLabel
                      icon={<TypeIcon type={option.value as CsvImportPropertyType} />}
                      label={option.label}
                      checked={!!checked}
                    />
                  )}
                  comboboxProps={{ withinPortal: false }}
                  aria-label={t("Property type for column {{name}}", { name: columnLabel })}
                />
              ) : type ? (
                // an existing property keeps its type
                <div className={classes.settingsValue}>
                  <TypeIcon type={type} />
                  {t(PROPERTY_TYPE_REGISTRY[type].labelKey)}
                </div>
              ) : null}
            </div>
            {warning && (
              <div className={classes.warningText}>
                <IconAlertTriangle size={13} aria-hidden />
                <span>{warning}</span>
              </div>
            )}
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
