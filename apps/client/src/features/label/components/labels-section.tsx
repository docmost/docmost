import { useState } from "react";
import clsx from "clsx";
import { Divider, Popover, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { LabelChip } from "@/features/label/components/label-chip.tsx";
import { LabelPicker } from "@/features/label/components/label-picker.tsx";
import {
  useAddLabelsMutation,
  usePageLabelsQuery,
  useRemoveLabelMutation,
} from "@/features/label/queries/label-query.ts";
import classes from "@/features/label/label.module.css";

type LabelsSectionProps = {
  pageId: string;
  canEdit: boolean;
};

export function LabelsSection({ pageId, canEdit }: LabelsSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data } = usePageLabelsQuery(pageId);
  const addMutation = useAddLabelsMutation(pageId);
  const removeMutation = useRemoveLabelMutation(pageId);

  const labels = data?.items ?? [];

  if (!canEdit && labels.length === 0) {
    return null;
  }

  const handleAdd = (name: string) => {
    addMutation.mutate({ pageId, names: [name] });
  };

  const handleRemove = (labelId: string) => {
    removeMutation.mutate({ pageId, labelId });
  };

  return (
    <>
      <Divider />
      <Stack gap="xs">
        <Text size="xs" fw={500} c="dimmed">
          {t("Labels")}
        </Text>
        <div className={classes.labelsWrap}>
          {labels.map((label) => (
            <LabelChip
              key={label.id}
              label={label}
              asLink
              onRemove={canEdit ? () => handleRemove(label.id) : undefined}
            />
          ))}
          {canEdit && (
            <Popover
              opened={open}
              onChange={setOpen}
              position="bottom-end"
              shadow="lg"
              withinPortal
              offset={6}
            >
              <Popover.Target>
                <button
                  type="button"
                  className={clsx(classes.addBtn, open && classes.addBtnOpen)}
                  onClick={() => setOpen((v) => !v)}
                >
                  <IconPlus size={12} stroke={2} />
                  <span>
                    {labels.length === 0 ? t("Add label") : t("Add")}
                  </span>
                </button>
              </Popover.Target>
              <Popover.Dropdown p={0} className={classes.popover}>
                <LabelPicker
                  applied={labels}
                  enabled={open}
                  onAdd={(name) => handleAdd(name)}
                  onClose={() => setOpen(false)}
                />
              </Popover.Dropdown>
            </Popover>
          )}
        </div>
      </Stack>
    </>
  );
}
