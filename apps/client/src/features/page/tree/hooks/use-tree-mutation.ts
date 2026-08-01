import { useCallback } from "react";
import { useAtom, useStore } from "jotai";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import type { DropOp } from "@/features/page/tree/model/tree-model.types";
import { dropOpToMovePayload } from "./drop-op-to-move-payload";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  useCreatePageMutation,
  useRemovePageMutation,
  useMovePageMutation,
  useUpdatePageMutation,
  updateCacheOnMovePage,
} from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import {
  pageKeysAtom,
  registerPageSection,
  sectionIdOf,
} from "@/features/encryption/hooks/page-key-store.ts";
import {
  encryptBytes,
  sectionAad,
} from "@/features/encryption/services/crypto.ts";
import {
  contentToYdocBlob,
  EMPTY_DOC,
  encryptSection,
} from "@/features/encryption/services/section-conversion.ts";
import {
  encryptionMessageForCode,
  getEncryptionErrorMessage,
  type EncryptionErrorCode,
} from "@/features/encryption/services/encryption-errors.ts";
import { confirmModal } from "@/features/page/tree/utils/confirm-modal.tsx";

export type UseTreeMutation = {
  handleMove: (sourceId: string, op: DropOp) => Promise<void>;
  handleCreate: (parentId: string | null) => Promise<void>;
  handleRename: (id: string, name: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
};

export function useTreeMutation(spaceId: string): UseTreeMutation {
  const { t } = useTranslation();
  const [, setData] = useAtom(treeDataAtom);
  // `store` reads the *current* treeDataAtom imperatively in handlers — avoids
  // stale-closure issues when the caller updates the tree (e.g. lazy-load
  // children) and then immediately invokes a handler.
  const store = useStore();
  const createPageMutation = useCreatePageMutation();
  const updatePageMutation = useUpdatePageMutation();
  const removePageMutation = useRemovePageMutation();
  const movePageMutation = useMovePageMutation();
  const navigate = useNavigate();
  const { spaceSlug, pageSlug } = useParams();
  const emit = useQueryEmit();

  const handleMove = useCallback(
    async (sourceId: string, op: DropOp) => {
      const before = store.get(treeDataAtom);
      const { tree: after, result } = treeModel.move(before, sourceId, op);
      if (after === before) return;

      const payload = dropOpToMovePayload(before, sourceId, op);
      const source = treeModel.find(before, sourceId) as SpaceTreeNode | null;
      if (!source) return;
      const oldParentId = source.parentPageId ?? null;

      // A move can never change which key a page is encrypted with — the
      // server refuses those. Dropping plaintext pages into an encrypted
      // section is the one case we can carry out, by encrypting them with
      // that section's key as part of the move.
      const targetParent = payload.parentPageId
        ? (treeModel.find(before, payload.parentPageId) as SpaceTreeNode | null)
        : null;
      const sourceSectionId = sectionIdOf(source);
      const targetSectionId = sectionIdOf(targetParent);

      let sectionDek: CryptoKey | null = null;
      if (sourceSectionId !== targetSectionId) {
        const targetKey = targetSectionId
          ? store.get(pageKeysAtom)[targetSectionId]
          : null;

        // an encryption root moving somewhere plaintext is a plain move: it
        // keeps its own key and its subtree follows
        const refusal: EncryptionErrorCode | null = source.encryptionRootId
          ? "ENCRYPTED_PAGE_MOVE_OUT"
          : sourceSectionId
            ? targetSectionId
              ? "ENCRYPTED_SECTION_NESTING"
              : null
            : targetKey
              ? null
              : "ENCRYPTION_REQUIRED";

        if (refusal) {
          notifications.show({
            message: encryptionMessageForCode(refusal, t),
            color: "orange",
          });
          return;
        }
        // null when relocating a whole section out to plaintext — that is a
        // plain move, with nothing to encrypt
        sectionDek = targetKey?.dek ?? null;
      }

      // optimistic apply with the new position from the payload
      let optimistic = treeModel.update(after, sourceId, {
        position: payload.position,
        parentPageId: payload.parentPageId,
      } as Partial<SpaceTreeNode>);

      // If the old parent has no children left, mark hasChildren: false so the
      // chevron disappears. Without this, the empty parent keeps rendering an
      // expand toggle that fetches zero rows on click.
      if (oldParentId) {
        const oldParent = treeModel.find(optimistic, oldParentId);
        if (!oldParent?.children?.length) {
          optimistic = treeModel.update(optimistic, oldParentId, {
            hasChildren: false,
          } as Partial<SpaceTreeNode>);
        }
      }

      // For make-child onto a previously-childless target: flip hasChildren on
      // so the new parent shows its chevron.
      if (op.kind === "make-child") {
        optimistic = treeModel.update(optimistic, op.targetId, {
          hasChildren: true,
        } as Partial<SpaceTreeNode>);
      }

      if (sectionDek) {
        const confirmed = await confirmModal({
          title: t("Encrypt this page and everything under it?"),
          message: t(
            "Moving pages into an encrypted section encrypts them with that section's password. They cannot be moved back out without being decrypted first. Encrypting permanently deletes page history, comments, shares, backlinks, and any files attached to these pages.",
          ),
          confirmLabel: t("Encrypt and move"),
          cancelLabel: t("Cancel"),
        });
        if (!confirmed) return;
      }

      setData(optimistic);

      try {
        if (sectionDek) {
          // conversion and move happen in one server transaction, so a
          // failure can never leave the subtree encrypted in the wrong place
          await encryptSection({
            pageId: sourceId,
            dek: sectionDek,
            joinRootId: targetSectionId,
            move: {
              parentPageId: payload.parentPageId,
              position: payload.position,
            },
          });
          // Other clients are not reloading, so tell them about the move
          // before this tab goes away — otherwise their tree keeps the page
          // in its old place, and dragging it again would be computed
          // against a position the server has already changed.
          emit({
            operation: "moveTreeNode",
            spaceId,
            payload: {
              id: sourceId,
              parentId: payload.parentPageId,
              oldParentId,
              index: result.index,
              position: payload.position,
              pageData: {
                id: source.id,
                slugId: source.slugId,
                title: source.name,
                icon: source.icon,
                position: payload.position,
                spaceId: source.spaceId,
                parentPageId: payload.parentPageId,
                hasChildren: source.hasChildren,
                isEncrypted: true,
                encryptionRootId: targetSectionId,
              },
            },
          });

          // every page that just changed also lost its plaintext collab
          // session; reloading rebuilds the tree and the editor from scratch
          // rather than patching encryption state across the moved subtree
          window.location.reload();
          return;
        }

        await movePageMutation.mutateAsync(payload);
      } catch (err) {
        setData(before);
        // a plain move can still be refused on encryption grounds when the
        // tree was stale, so always let a coded refusal explain itself
        notifications.show({
          message: getEncryptionErrorMessage(err, t, t("Failed to move page")),
          color: "red",
        });
        return;
      }

      const pageData: Partial<IPage> = {
        id: source.id,
        slugId: source.slugId,
        title: source.name,
        icon: source.icon,
        position: payload.position,
        spaceId: source.spaceId,
        parentPageId: payload.parentPageId,
        hasChildren: source.hasChildren,
      };

      updateCacheOnMovePage(
        spaceId,
        sourceId,
        oldParentId,
        payload.parentPageId,
        pageData,
      );

      setTimeout(() => {
        emit({
          operation: "moveTreeNode",
          spaceId: spaceId,
          payload: {
            id: sourceId,
            parentId: payload.parentPageId,
            oldParentId,
            index: result.index,
            position: payload.position,
            pageData,
          },
        });
      }, 50);
    },
    [setData, store, movePageMutation, spaceId, emit, t],
  );

  const handleCreate = useCallback(
    async (parentId: string | null) => {
      const payload: {
        spaceId: string;
        parentPageId?: string;
        encryptedBlob?: string;
      } = { spaceId };
      if (parentId) payload.parentPageId = parentId;

      // A page nested under an encrypted one joins that section, so it must
      // be born encrypted — which needs the section key in the vault.
      const parent = parentId
        ? (treeModel.find(
            store.get(treeDataAtom),
            parentId,
          ) as SpaceTreeNode | null)
        : null;
      const parentSectionId = sectionIdOf(parent);

      if (parentSectionId) {
        const entry = store.get(pageKeysAtom)[parentSectionId];
        if (!entry) {
          notifications.show({
            message: t("Unlock the encrypted section to add pages to it."),
            color: "orange",
          });
          throw new Error("Encrypted section is locked");
        }
        payload.encryptedBlob = await encryptBytes(
          entry.dek,
          contentToYdocBlob(EMPTY_DOC),
          sectionAad(parentSectionId),
        );
      }

      let createdPage: IPage;
      try {
        createdPage = await createPageMutation.mutateAsync(payload);
      } catch {
        throw new Error("Failed to create page");
      }

      const newNode: SpaceTreeNode = {
        id: createdPage.id,
        slugId: createdPage.slugId,
        name: "",
        position: createdPage.position,
        spaceId: createdPage.spaceId,
        parentPageId: createdPage.parentPageId,
        hasChildren: false,
        isEncrypted: createdPage.isEncrypted,
        encryptionRootId: createdPage.encryptionRootId,
        children: [],
      };
      registerPageSection(createdPage.id, createdPage.encryptionRootId);

      // Read latest tree at call time. Without this, callers that mutate the
      // tree (e.g. lazy-load children on expand) immediately before calling
      // handleCreate hit a stale closure and compute lastIndex against the
      // pre-load tree, requiring a setTimeout-based wait at the call site.
      const current = store.get(treeDataAtom);
      let lastIndex: number;
      if (parentId === null) {
        lastIndex = current.length;
      } else {
        const parent = treeModel.find(current, parentId);
        lastIndex = parent?.children?.length ?? 0;
      }

      setData((prev) => treeModel.insert(prev, parentId, newNode, lastIndex));

      setTimeout(() => {
        emit({
          operation: "addTreeNode",
          spaceId,
          payload: {
            parentId,
            index: lastIndex,
            data: newNode,
          },
        });
      }, 50);

      const pageUrl = buildPageUrl(
        spaceSlug,
        createdPage.slugId,
        createdPage.title,
      );
      navigate(pageUrl);
    },
    [spaceId, createPageMutation, setData, store, emit, navigate, spaceSlug, t],
  );

  const handleRename = useCallback(
    async (id: string, name: string) => {
      setData((prev) =>
        treeModel.update(prev, id, { name } as Partial<SpaceTreeNode>),
      );
      try {
        await updatePageMutation.mutateAsync({ pageId: id, title: name });
      } catch (error) {
        console.error("Error updating page title:", error);
      }
    },
    [updatePageMutation, setData],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const node = treeModel.find(
        store.get(treeDataAtom),
        id,
      ) as SpaceTreeNode | null;
      const parentPageId = node?.parentPageId ?? null;
      try {
        await removePageMutation.mutateAsync(id);
        setData((prev) => {
          let next = treeModel.remove(prev, id);
          // If the parent has no children left, mark hasChildren: false so the
          // chevron disappears. Without this, the empty parent keeps rendering an
          // expand toggle that fetches zero rows on click.
          if (parentPageId) {
            const parent = treeModel.find(next, parentPageId);
            if (!parent?.children?.length) {
              next = treeModel.update(next, parentPageId, {
                hasChildren: false,
              } as Partial<SpaceTreeNode>);
            }
          }
          return next;
        });

        if (
          node &&
          pageSlug &&
          (node.slugId === pageSlug.split("-")[1] ||
            isPageInNode(node, pageSlug.split("-")[1]))
        ) {
          navigate(getSpaceUrl(spaceSlug));
        }

        setTimeout(() => {
          if (!node) return;
          emit({
            operation: "deleteTreeNode",
            spaceId,
            payload: { node },
          });
        }, 50);
      } catch (error) {
        console.error("Failed to delete page:", error);
      }
    },
    [removePageMutation, setData, store, pageSlug, navigate, spaceSlug, emit, spaceId],
  );

  return { handleMove, handleCreate, handleRename, handleDelete };
}

function isPageInNode(node: SpaceTreeNode, pageSlug: string): boolean {
  if (node.slugId === pageSlug) return true;
  if (!node.children) return false;
  for (const child of node.children) {
    if (isPageInNode(child, pageSlug)) return true;
  }
  return false;
}
