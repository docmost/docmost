import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import { Popover } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { PropertyMenuContent } from "@/ee/base/components/property/property-menu";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { DetailField } from "./fields/detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

type PropertyRowProps = {
  property: IBaseProperty;
  row: IBaseRow;
  pageId: string;
  menuOpened: boolean;
  onMenuOpenChange: (opened: boolean) => void;
  onMenuDirtyChange: (dirty: boolean) => void;
  onUpdate: (propertyId: string, value: unknown) => void;
  autoFocusValue?: boolean;
  onAutoFocused?: () => void;
};

export function PropertyRow({
  property,
  row,
  pageId,
  menuOpened,
  onMenuOpenChange,
  onMenuDirtyChange,
  onUpdate,
  autoFocusValue,
  onAutoFocused,
}: PropertyRowProps) {
  const canEdit = useBaseEditable();
  const rowRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!autoFocusValue || focusedRef.current) return;
    focusedRef.current = true;
    const el = rowRef.current;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      el.querySelector<HTMLElement>("input, textarea")?.focus();
    }
    onAutoFocused?.();
  }, [autoFocusValue, onAutoFocused]);

  const handleLabelClick = useCallback(() => {
    onMenuOpenChange(!menuOpened);
  }, [menuOpened, onMenuOpenChange]);

  const handleMenuClose = useCallback(() => {
    onMenuOpenChange(false);
  }, [onMenuOpenChange]);

  const Icon = getDescriptor(property.type)?.icon;

  const label = (
    <>
      {Icon && <Icon size={15} className={classes.propertyLabelIcon} />}
      <span className={classes.propertyLabelText}>{property.name}</span>
    </>
  );

  return (
    <div className={classes.propertyRow} ref={rowRef}>
      {canEdit ? (
        <Popover
          opened={menuOpened}
          position="bottom-start"
          shadow="md"
          width={260}
          withinPortal
          closeOnClickOutside={false}
          closeOnEscape={false}
          hideDetached={false}
        >
          <Popover.Target>
            <button
              type="button"
              className={clsx(classes.propertyLabel, classes.propertyLabelButton, {
                [classes.propertyLabelActive]: menuOpened,
              })}
              onClick={handleLabelClick}
              data-property-menu-target
            >
              {label}
              <IconChevronDown size={13} className={classes.propertyLabelChevron} />
            </button>
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PropertyMenuContent
              property={property}
              opened={menuOpened}
              onClose={handleMenuClose}
              onDirtyChange={onMenuDirtyChange}
              pageId={pageId}
            />
          </Popover.Dropdown>
        </Popover>
      ) : (
        <div className={classes.propertyLabel}>{label}</div>
      )}
      <DetailField
        property={property}
        row={row}
        readOnly={!canEdit}
        onUpdate={onUpdate}
      />
    </div>
  );
}
