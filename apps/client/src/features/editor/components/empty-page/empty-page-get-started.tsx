import { useEffect, useState } from "react";
import { Button } from "@mantine/core";
import { IconTable, IconLayoutKanban } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { useConvertPageToBaseMutation } from "@/ee/base/queries/base-query";
import {
  pageEditorAtom,
  yjsSyncedAtom,
} from "@/features/editor/atoms/editor-atoms";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import classes from "./empty-page-get-started.module.css";

type EmptyPageGetStartedProps = {
  pageId: string;
  editable: boolean;
};

export function EmptyPageGetStarted({
  pageId,
  editable,
}: EmptyPageGetStartedProps) {
  const { t } = useTranslation();
  const editor = useAtomValue(pageEditorAtom);
  const isSynced = useAtomValue(yjsSyncedAtom);
  const hasBases = useHasFeature(Feature.BASES);
  const convertMutation = useConvertPageToBaseMutation();

  const [isEmpty, setIsEmpty] = useState(false);
  useEffect(() => {
    if (!editor) return;
    const sync = () => setIsEmpty(editor.isEmpty);
    sync();
    editor.on("update", sync);
    editor.on("create", sync);
    return () => {
      editor.off("update", sync);
      editor.off("create", sync);
    };
  }, [editor]);

  if (!editable || !hasBases || !editor || !isSynced || !isEmpty) return null;

  const chips = [
    {
      key: "base",
      label: t("Base"),
      icon: IconTable,
      onClick: () => convertMutation.mutate({ pageId }),
      disabled: convertMutation.isPending,
    },
    {
      key: "kanban",
      label: t("Kanban"),
      icon: IconLayoutKanban,
      onClick: () => convertMutation.mutate({ pageId, template: "kanban" }),
      disabled: convertMutation.isPending,
    },
  ];

  return (
    <div className={classes.wrapper} contentEditable={false}>
      <span className={classes.label}>{t("Get started with")}</span>
      <div className={classes.chipRow}>
        {chips.map((chip) => (
          <Button
            key={chip.key}
            variant="default"
            size="xs"
            radius="xl"
            leftSection={<chip.icon size={16} />}
            onClick={chip.onClick}
            disabled={chip.disabled}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
