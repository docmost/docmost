import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconTable,
  IconLayoutKanban,
  IconTemplate,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { ErrorBoundary } from "react-error-boundary";
import { useConvertPageToBaseMutation } from "@/ee/base/queries/base-query";
import {
  pageEditorAtom,
  titleEditorAtom,
  yjsSyncedAtom,
} from "@/features/editor/atoms/editor-atoms";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { ITemplate } from "@/ee/template/types/template.types";
import { getTemplateById } from "@/ee/template/services/template-service.ts";
import { applyTemplateToPage } from "@/ee/template/template.utils";
import classes from "./empty-page-get-started.module.css";

const TemplatePickerModal = lazy(
  () => import("@/ee/template/components/template-picker-modal"),
);

type EmptyPageGetStartedProps = {
  pageId: string;
  spaceId: string;
  editable: boolean;
};

export function EmptyPageGetStarted({
  pageId,
  spaceId,
  editable,
}: EmptyPageGetStartedProps) {
  const { t } = useTranslation();
  const editor = useAtomValue(pageEditorAtom);
  const titleEditor = useAtomValue(titleEditorAtom);
  const isSynced = useAtomValue(yjsSyncedAtom);
  const hasBases = useHasFeature(Feature.BASES);
  const hasTemplates = useHasFeature(Feature.TEMPLATES);
  const convertMutation = useConvertPageToBaseMutation();
  const [
    templatePickerOpened,
    { open: openTemplatePicker, close: closeTemplatePicker },
  ] = useDisclosure(false);

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

  const handleUseTemplate = async (selected: ITemplate) => {
    let template: ITemplate;
    try {
      template = await getTemplateById(selected.id);
    } catch {
      notifications.show({
        message: t("Failed to load template"),
        color: "red",
      });
      return;
    }

    if (
      !editor ||
      editor.isDestroyed ||
      !titleEditor ||
      titleEditor.isDestroyed
    ) {
      return;
    }

    if (!applyTemplateToPage(editor, titleEditor, template)) {
      notifications.show({
        message: t("This page is no longer empty"),
        color: "red",
      });
    }
  };

  const chips = [
    ...(hasBases
      ? [
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
            onClick: () =>
              convertMutation.mutate({ pageId, template: "kanban" }),
            disabled: convertMutation.isPending,
          },
        ]
      : []),
    ...(hasTemplates
      ? [
          {
            key: "template",
            label: t("Template"),
            icon: IconTemplate,
            onClick: openTemplatePicker,
            disabled: false,
          },
        ]
      : []),
  ];

  const showChips =
    editable && !!editor && isSynced && isEmpty && chips.length > 0;

  return (
    <>
      {showChips && (
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
      )}

      {hasTemplates && templatePickerOpened && (
        <ErrorBoundary fallbackRender={() => null}>
          <Suspense fallback={null}>
            <TemplatePickerModal
              opened={templatePickerOpened}
              onClose={closeTemplatePicker}
              initialSpaceId={spaceId}
              onUse={handleUseTemplate}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
