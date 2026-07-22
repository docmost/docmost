import React from "react";
import { Menu } from "@mantine/core";
import {
  IconLock,
  IconLockOpen,
  IconLockOff,
  IconKey,
} from "@tabler/icons-react";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { IPage } from "@/features/page/types/page.types";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import {
  usePageKey,
  useUnlockPageKey,
  useLockPageKey,
} from "@/features/encryption/hooks/page-key-store";
import {
  convertPageToEncrypted,
  decryptPageToPlaintext,
  rewrapPageKey,
} from "@/features/encryption/services/encryption-service";
import { encryptBytes, rewrapDek } from "@/features/encryption/services/crypto";
import { SetPasswordModal } from "@/features/encryption/components/set-password-modal";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

// Which encryption modal is open. Lives in an atom because the menu items sit
// inside <Menu.Dropdown>, which unmounts when the menu closes — the modals
// must be rendered outside the menu (see PageEncryptionModals).
const encryptionModalAtom = atom(null as null | "enable" | "change");

interface PageEncryptionMenuItemsProps {
  page: IPage;
  readOnly?: boolean;
}

/**
 * Menu items for the page action menu: enable encryption, change password,
 * lock now, and remove encryption. Render PageEncryptionModals as a sibling
 * of the <Menu> for the modals to work.
 */
export function PageEncryptionMenuItems({
  page,
  readOnly,
}: PageEncryptionMenuItemsProps) {
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const dek = usePageKey(page?.id);
  const lockPageKey = useLockPageKey();
  const setOpenModal = useSetAtom(encryptionModalAtom);

  if (!page || page.isBase || readOnly) {
    return null;
  }

  const handleRemoveEncryption = () => {
    if (!dek || !pageEditor || pageEditor.isDestroyed) {
      notifications.show({
        message: t("Unlock the page before removing encryption"),
        color: "orange",
      });
      return;
    }
    modals.openConfirmModal({
      title: t("Remove encryption from this page?"),
      children: (
        <Text size="sm">
          {t(
            "The page content will be decrypted and stored on the server in plaintext again, readable by anyone with access to the page or the server.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove encryption"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await decryptPageToPlaintext({
          pageId: page.id,
          content: pageEditor.getJSON(),
        });
        lockPageKey(page.id);
        notifications.show({ message: t("Encryption removed") });
        window.location.reload();
      },
    });
  };

  return (
    <>
      <Menu.Divider />
      {!page.isEncrypted && (
        <Menu.Item
          leftSection={<IconLock size={16} />}
          onClick={() => setOpenModal("enable")}
        >
          {t("Encrypt page")}
        </Menu.Item>
      )}
      {page.isEncrypted && dek && (
        <>
          <Menu.Item
            leftSection={<IconLock size={16} />}
            onClick={() => lockPageKey(page.id)}
          >
            {t("Lock now")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconKey size={16} />}
            onClick={() => setOpenModal("change")}
          >
            {t("Change encryption password")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLockOff size={16} />}
            onClick={handleRemoveEncryption}
          >
            {t("Remove encryption")}
          </Menu.Item>
        </>
      )}
      {page.isEncrypted && !dek && (
        <Menu.Item leftSection={<IconLockOpen size={16} />} disabled>
          {t("Page is locked")}
        </Menu.Item>
      )}
    </>
  );
}

interface PageEncryptionModalsProps {
  page: IPage;
}

/**
 * The modals backing PageEncryptionMenuItems. Must be rendered OUTSIDE the
 * <Menu> component so they survive the menu dropdown unmounting on close.
 */
export function PageEncryptionModals({ page }: PageEncryptionModalsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pageEditor = useAtomValue(pageEditorAtom);
  const dek = usePageKey(page?.id);
  const unlockPageKey = useUnlockPageKey();
  const [openModal, setOpenModal] = useAtom(encryptionModalAtom);

  if (!page || page.isBase) {
    return null;
  }

  const handleEncrypt = async ({
    meta,
    dek: newDek,
  }: {
    meta: EncryptionMeta | null;
    dek: CryptoKey | null;
  }) => {
    if (!meta || !newDek) return;
    // prefer the live editor state over the possibly stale query cache
    const content =
      pageEditor && !pageEditor.isDestroyed
        ? pageEditor.getJSON()
        : (page.content ?? EMPTY_DOC);

    const bytes = new TextEncoder().encode(JSON.stringify(content));
    const encryptedBlob = await encryptBytes(newDek, bytes);

    await convertPageToEncrypted({
      pageId: page.id,
      encryptionMeta: meta,
      encryptedBlob,
    });

    unlockPageKey(page.id, newDek);
    setOpenModal(null);
    notifications.show({ message: t("Page encrypted") });
    // full reload tears down the collaboration session cleanly
    window.location.reload();
  };

  const handleRewrap = async (newPassword: string) => {
    if (!dek || !page.encryptionMeta) {
      notifications.show({
        message: t("Unlock the page before changing its password"),
        color: "orange",
      });
      setOpenModal(null);
      return;
    }
    const newMeta = await rewrapDek(dek, newPassword);
    await rewrapPageKey({
      pageId: page.id,
      encryptionMeta: newMeta,
      currentWrappedDek: page.encryptionMeta.wrappedDek,
    });
    await queryClient.invalidateQueries({ queryKey: ["pages"] });
    setOpenModal(null);
    notifications.show({ message: t("Encryption password changed") });
  };

  return (
    <>
      <SetPasswordModal
        opened={openModal === "enable"}
        onClose={() => setOpenModal(null)}
        mode="enable"
        onSubmit={handleEncrypt}
      />
      <SetPasswordModal
        opened={openModal === "change"}
        onClose={() => setOpenModal(null)}
        mode="change"
        onSubmit={async ({ password }) => handleRewrap(password)}
      />
    </>
  );
}
