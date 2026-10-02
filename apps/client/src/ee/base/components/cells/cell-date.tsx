import { useCallback } from "react";
import { Popover } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  IBaseProperty,
  DateTypeOptions,
} from "@/ee/base/types/base.types";
import { DateValuePicker } from "@/ee/base/components/date-picker/date-value-picker";
import { useUpdatePropertyMutation } from "@/ee/base/queries/base-property-query";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import {
  DateValue,
  formatDateValue,
  parseDateValue,
} from "@/ee/base/utils/date-value";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text";
import cellClasses from "@/ee/base/styles/cells.module.css";
import gridClasses from "@/ee/base/styles/grid.module.css";

type CellDateProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onValueChange: (value: unknown) => void;
  onCancel: () => void;
};

type DateCellPickerProps = {
  property: IBaseProperty;
  value: DateValue | null;
  onChange: (next: DateValue | null) => void;
};

export function DateCellPicker({
  property,
  value,
  onChange,
}: DateCellPickerProps) {
  const editable = useBaseEditable();
  const updatePropertyMutation = useUpdatePropertyMutation();
  const typeOptions = (
    updatePropertyMutation.isPending
      ? updatePropertyMutation.variables.typeOptions
      : property.typeOptions
  ) as DateTypeOptions | undefined;

  const handlePropertyFormatChange = (
    patch: Pick<DateTypeOptions, "dateFormat" | "timeFormat">,
  ) =>
    updatePropertyMutation.mutate({
      propertyId: property.id,
      pageId: property.pageId,
      typeOptions: { ...typeOptions, ...patch },
    });

  return (
    <DateValuePicker
      value={value}
      onChange={onChange}
      defaultIncludeTime={typeOptions?.includeTime}
      dateFormat={typeOptions?.dateFormat}
      timeFormat={typeOptions?.timeFormat}
      onPropertyFormatChange={editable ? handlePropertyFormatChange : undefined}
    />
  );
}

export function CellDate({
  value,
  property,
  isEditing,
  onValueChange,
  onCancel,
}: CellDateProps) {
  const { i18n } = useTranslation();
  const typeOptions =
    property.type === "date"
      ? (property.typeOptions as DateTypeOptions | undefined)
      : undefined;
  const dateValue = parseDateValue(value);
  const display = formatDateValue(dateValue, {
    dateFormat: typeOptions?.dateFormat,
    timeFormat: typeOptions?.timeFormat,
    locale: i18n.language,
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  if (isEditing) {
    return (
      <Popover
        opened
        onChange={(o) => {
          if (!o) onCancel();
        }}
        onClose={onCancel}
        position="bottom-start"
        width="auto"
        middlewares={{ flip: true, shift: { crossAxis: true, padding: 8 } }}
        trapFocus
        closeOnClickOutside
        closeOnEscape
        hideDetached={false}
      >
        <Popover.Target>
          <div className={cellClasses.popoverTargetFlex}>
            <span
              className={`${gridClasses.cellContent} ${cellClasses.dateValue}`}
            >
              {display}
            </span>
          </div>
        </Popover.Target>
        <Popover.Dropdown
          p={0}
          onKeyDown={handleKeyDown}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <DateCellPicker
            property={property}
            value={dateValue}
            onChange={onValueChange}
          />
        </Popover.Dropdown>
      </Popover>
    );
  }

  if (!display) {
    return <span className={cellClasses.emptyValue} />;
  }

  return (
    <AutoTooltipText
      className={`${gridClasses.cellContent} ${cellClasses.dateValue}`}
      fz="sm"
      tooltipProps={{ withinPortal: true }}
    >
      {display}
    </AutoTooltipText>
  );
}
