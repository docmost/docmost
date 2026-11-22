import { ActionIcon, Button, Group, Modal } from "@mantine/core";
import { IconSettings, IconTags } from "@tabler/icons-react";
import {
  normalizePagesByLabelAttributes,
  pagesByLabelSettingsKey,
  type PagesByLabelAttributes,
} from "@docmost/editor-ext";
import {
  NodeViewWrapper,
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import { useContext, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { PagesByLabelContext } from "./pages-by-label-context";
import { pageEditorBindingAtom } from "@/features/editor/atoms/editor-atoms";
import { PagesByLabelResults } from "./pages-by-label-results";
import { PagesByLabelSettings } from "./pages-by-label-settings";
import classes from "../subpages/subpages.module.css";
import styles from "./pages-by-label.module.css";

export function PagesByLabelView({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation();
  const host = useContext(PagesByLabelContext);
  const { pathname } = useLocation();
  const binding = useAtomValue(pageEditorBindingAtom);
  const { editable: editorEditable, openOnInsert } = useEditorState({
    editor,
    selector: ({ editor }) => {
      const requested = pagesByLabelSettingsKey.getState(editor.state);
      return {
        editable: editor.isEditable,
        openOnInsert: typeof requested === "number" && requested === getPos(),
      };
    },
  });
  const editable =
    binding?.editor === editor ? binding.editable : editorEditable;
  const options = normalizePagesByLabelAttributes(node.attrs);
  const [editing, setEditing] = useState<PagesByLabelAttributes | null>(null);
  useEffect(() => {
    if (!editable) setEditing(null);
    else if (openOnInsert) {
      setEditing(normalizePagesByLabelAttributes(node.attrs));
      editor.view.dispatch(
        editor.state.tr.setMeta(pagesByLabelSettingsKey, null),
      );
    }
  }, [node, editable, openOnInsert, editor]);
  if (/^\/(share|docs)(\/|$)/i.test(pathname)) return null;
  if (!host)
    return (
      <NodeViewWrapper>
        {options.heading || t("Pages by label")}
      </NodeViewWrapper>
    );

  const settingsButton = editable && options.labels.length > 0 && (
    <ActionIcon
      className={styles.settings + " print-hide"}
      variant="subtle"
      color="gray"
      size="sm"
      aria-label={t("Pages by label settings")}
      onClick={() => setEditing(options)}
    >
      <IconSettings size={16} />
    </ActionIcon>
  );
  return (
    <NodeViewWrapper
      data-type="pages-by-label"
      contentEditable={false}
      className={classes.card + " " + styles.block}
      data-print-heading={options.heading || t("Pages by label")}
    >
      {!!options.heading && (
        <div className={classes.header}>
          <h3 className={styles.heading}>{options.heading}</h3>
          {settingsButton}
        </div>
      )}
      <div
        className={
          !options.heading && settingsButton ? styles.headless : undefined
        }
      >
        {!options.heading && settingsButton}
        {options.labels.length ? (
          <PagesByLabelResults options={options} />
        ) : (
          <Group gap="xs" className={classes.empty}>
            <IconTags size={18} aria-hidden />
            {editable ? (
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => setEditing(options)}
              >
                {t("Choose labels")}
              </Button>
            ) : (
              t("No labels selected")
            )}
          </Group>
        )}
      </div>
      {editable && editing && (
        <Modal
          opened
          onClose={() => setEditing(null)}
          title={t("Pages by label")}
          size={576}
          padding={24}
          classNames={{ title: styles.modalTitle, header: styles.modalHeader }}
          closeButtonProps={{ "aria-label": t("Close") }}
        >
          <PagesByLabelSettings
            initial={editing}
            onClose={() => setEditing(null)}
            onSave={(changes) => {
              if (editor.isEditable && Object.keys(changes).length) {
                const pos = getPos();
                const current =
                  typeof pos === "number" && editor.state.doc.nodeAt(pos);
                if (current && current.type === node.type) {
                  updateAttributes({
                    ...normalizePagesByLabelAttributes(current.attrs),
                    ...changes,
                  });
                }
              }
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </NodeViewWrapper>
  );
}
