import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { prosemirrorJSONToYDoc, ySyncPluginKey } from "y-prosemirror";
import {
  activeHistoryIdAtom,
  historyAtoms,
} from "@/features/page-history/atoms/history-atoms";
import {
  fetchPageHistory,
  usePageHistoryQuery,
} from "@/features/page-history/queries/page-history-query";
import { IPageHistory } from "@/features/page-history/types/page.types";
import { decryptBlobToProsemirrorJSON } from "@/features/encryption/services/encrypted-blob";
import { usePageKey } from "@/features/encryption/hooks/page-key-store";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";

/**
 * Replace the editor's document with `content`.
 *
 * When the editor is Collaboration-bound its document lives in a Y.Doc, and
 * rewriting the ProseMirror doc with setContent leaves the y-binding to
 * reverse-engineer the change into CRDT ops — risking residual fragment state
 * and divergence between peers (the same reason the v1 blob migration seeds
 * the Y.Doc before the editor mounts, see encrypted-page-editor.tsx). So write
 * the bound fragment directly, in one transaction, and let the binding update
 * the view. setContent stays the path for a plain, non-collab editor.
 */
function restoreEditorContent(editor: any, content: any) {
  const fragment = ySyncPluginKey.getState(editor.state)?.type;
  const ydoc: Y.Doc | undefined = fragment?.doc;

  if (!fragment || !ydoc) {
    editor.chain().clearContent().setContent(content).run();
    return;
  }

  // build the replacement in a throwaway doc, then graft its (unintegrated)
  // clones in — a fragment's nodes cannot be moved between docs directly
  const seeded = prosemirrorJSONToYDoc(editor.schema, content, "default");
  try {
    const restored = seeded
      .getXmlFragment("default")
      .toArray()
      .map((node: any) => node.clone());
    ydoc.transact(() => {
      fragment.delete(0, fragment.length);
      fragment.insert(0, restored);
    });
  } finally {
    seeded.destroy();
  }
}

export function useHistoryRestore() {
  const { t } = useTranslation();

  const activeHistoryId = useAtomValue(activeHistoryIdAtom);
  const { data: activeHistoryData } = usePageHistoryQuery(activeHistoryId);

  // every version listed belongs to the same page, so the active version is
  // enough to resolve the page key — decrypted on demand rather than on every
  // render: restoring is a click, and the history view already decrypts the
  // version it displays
  const dek = usePageKey(activeHistoryData?.pageId ?? "");

  const mainEditor = useAtomValue(pageEditorAtom);
  const mainEditorTitle = useAtomValue(titleEditorAtom);
  const setHistoryModalOpen = useSetAtom(historyAtoms);

  const { spaceSlug } = useParams();
  const { data: space } = useSpaceQuery(spaceSlug);
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);

  const canRestore = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  const handleRestore = useCallback(
    async (historyId: string) => {
      let historyData: IPageHistory;
      try {
        historyData = await fetchPageHistory(historyId);
      } catch {
        notifications.show({
          message: t("Error fetching page data."),
          color: "red",
        });
        return;
      }

      let content = historyData.content;
      if (historyData.isEncrypted) {
        if (!dek || !historyData.encryptedBlob) {
          notifications.show({
            message: t("Unlock this page before restoring a version."),
            color: "red",
          });
          return;
        }
        try {
          content = await decryptBlobToProsemirrorJSON(
            dek,
            historyData.encryptedBlob,
          );
        } catch {
          notifications.show({
            message: t("Failed to decrypt this version."),
            color: "red",
          });
          return;
        }
      }

      // re-checked after the await: the editor may have unmounted meanwhile
      if (
        !mainEditor ||
        mainEditor.isDestroyed ||
        !mainEditorTitle ||
        mainEditorTitle.isDestroyed
      ) {
        return;
      }

      mainEditorTitle
        .chain()
        .clearContent()
        .setContent(historyData.title, { emitUpdate: true })
        .run();

      restoreEditorContent(mainEditor, content);

      // An encrypted editor writes through a Y.Doc, and a direct fragment write
      // is indistinguishable from a peer's edit — it would only be persisted by
      // the slow remote-durability fallback, so a reload before that fires would
      // silently undo the restore. Flush it (and snapshot it) before reporting
      // success. No-op for plain editors, which persist through their own path.
      const persistEncrypted = (mainEditor as any).storage?.persistEncrypted as
        | (() => Promise<void>)
        | undefined;
      if (persistEncrypted) {
        // rejects if the write was lost (network, hard conflict) — the caller
        // turns that into a failure toast rather than claiming success
        await persistEncrypted();
      } else if (historyData.isEncrypted) {
        // the encrypted editor always exposes this handle; without it the
        // restore would live only in the local Y.Doc
        throw new Error("editor cannot persist the restored version");
      }

      setHistoryModalOpen(false);
      notifications.show({ message: t("Successfully restored") });
    },
    [dek, mainEditor, mainEditorTitle, setHistoryModalOpen, t],
  );

  const confirmRestore = useCallback(
    (historyId?: string) => {
      const targetId = historyId ?? activeHistoryId;
      if (!targetId) return;

      modals.openConfirmModal({
        title: t("Please confirm your action"),
        children: (
          <Text size="sm">
            {t(
              "Are you sure you want to restore this version? Any changes not versioned will be lost.",
            )}
          </Text>
        ),
        labels: { confirm: t("Confirm"), cancel: t("Cancel") },
        onConfirm: () => {
          // the modal is already gone by the time this rejects — surface it
          // instead of leaving an unhandled rejection and a silent no-op
          handleRestore(targetId).catch(() => {
            notifications.show({
              message: t("Failed to restore this version."),
              color: "red",
            });
          });
        },
      });
    },
    [t, handleRestore, activeHistoryId],
  );

  return { canRestore, confirmRestore };
}
