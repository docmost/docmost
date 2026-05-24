import { Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";
import {
  IBase,
  IBaseRow,
} from "@/features/base/types/base.types";
import { useUpdateRowMutation } from "@/features/base/queries/base-row-query";
import { CreatePropertyPopover } from "@/features/base/components/property/create-property-popover";
import { RowDetailTitle } from "./row-detail-title";
import { PropertyRow } from "./property-row";

type RowDetailModalProps = {
  base: IBase;
  rows: IBaseRow[];
  openRowId: string | null;
  onClose: () => void;
};

export function RowDetailModal({
  base,
  rows,
  openRowId,
  onClose,
}: RowDetailModalProps) {
  const { t } = useTranslation();
  const updateRowMutation = useUpdateRowMutation();

  const row = useMemo(
    () => (openRowId ? rows.find((r) => r.id === openRowId) : undefined),
    [openRowId, rows],
  );
  const primaryProperty = useMemo(
    () => base.properties.find((p) => p.isPrimary),
    [base.properties],
  );

  // If a row was open and disappeared (deleted, filtered out, or not yet
  // loaded into the rows page), close the modal.
  const wasOpen = !!openRowId && !row;
  useEffect(() => {
    if (wasOpen) onClose();
  }, [wasOpen, onClose]);

  return (
    <Modal
      opened={!!row}
      onClose={onClose}
      size="lg"
      withCloseButton
      centered
      title={null}
    >
      {row ? (
        <Stack gap="md">
          <RowDetailTitle
            row={row}
            primaryProperty={primaryProperty}
            onCommit={(value) => {
              if (!primaryProperty) return;
              updateRowMutation.mutate({
                rowId: row.id,
                pageId: base.id,
                cells: { [primaryProperty.id]: value },
              });
            }}
          />
          {base.properties
            .filter((p) => !p.isPrimary)
            .map((property) => (
              <PropertyRow
                key={property.id}
                property={property}
                row={row}
                onUpdate={(propertyId, value) => {
                  updateRowMutation.mutate({
                    rowId: row.id,
                    pageId: base.id,
                    cells: { [propertyId]: value },
                  });
                }}
              />
            ))}
          <CreatePropertyPopover
            pageId={base.id}
            properties={base.properties}
            onPropertyCreated={() => {
              // The base query invalidates on success — the new property will
              // appear as a new <PropertyRow /> on next render. Nothing else to do.
            }}
          />
        </Stack>
      ) : (
        <Text c="dimmed">{t("Loading…")}</Text>
      )}
    </Modal>
  );
}
