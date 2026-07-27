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
  broadcastPageLock,
  usePageKey,
  useUnlockPageKey,
  useLockPageKey,
} from "@/features/encryption/hooks/page-key-store";
import { rewrapPageKey } from "@/features/encryption/services/encryption-service";
import { rewrapDek } from "@/features/encryption/services/crypto";
import {
  decryptSection,
  encryptSection,
} from "@/features/encryption/services/section-conversion";
import { getEncryptionErrorMessage as getSectionErrorMessage } from "@/features/encryption/services/encryption-errors";
import { SetPasswordModal } from "@/features/encryption/components/set-password-modal";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import { editorForPage } from "@/features/encryption/utils/editor-for-page";

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
    if (!dek) {
      notifications.show({
        message: t("Unlock the page before removing encryption"),
        color: "orange",
      });
      return;
    }
    // only this page's editor may contribute unsaved content; without it the
    // stored ciphertext is decrypted instead, which is always safe
    const liveEditor = editorForPage(pageEditor, page.id);
    // decryption always covers the whole section, so say so in the title when
    // there is more at stake than the page the user clicked
    modals.openConfirmModal({
      title: page.hasChildren
        ? t("Remove encryption from this page and everything under it?")
        : t("Remove encryption from this page?"),
      children: (
        <Text size="sm">
          {page.hasChildren
            ? t(
                "This page and every page nested under it — including any in the trash — will be decrypted and stored on the server in plaintext again, readable by anyone with access to the page or the server.",
              )
            : t(
                "The page content will be decrypted and stored on the server in plaintext again, readable by anyone with access to the page or the server.",
              )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove encryption"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await decryptSection({
            pageId: page.id,
            dek,
            rootContent: liveEditor?.getJSON(),
          });
        } catch (err) {
          notifications.show({
            message: getSectionErrorMessage(err, t),
            color: "red",
          });
          return;
        }
        lockPageKey(page.id);
        broadcastPageLock(page.id);
        notifications.show({ message: t("Encryption removed") });
        window.location.reload();
      },
    });
  };

  // encryption always covers the whole subtree: a plaintext page inside an
  // encrypted section would silently leak what the section is meant to hide
  const handleEncryptClick = () => {
    if (!page.hasChildren) {
      setOpenModal("enable");
      return;
    }
    modals.openConfirmModal({
      title: t("Encrypt this page and everything under it?"),
      children: (
        <Text size="sm">
          {t(
            "Every page nested under this one — including any in the trash — will be encrypted with the same password. Pages cannot be moved out of an encrypted section without decrypting them first.",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Continue"), cancel: t("Cancel") },
      onConfirm: () => setOpenModal("enable"),
    });
  };

  return (
    <>
      <Menu.Divider />
      {!page.isEncrypted && (
        <Menu.Item
          leftSection={<IconLock size={16} />}
          onClick={handleEncryptClick}
        >
          {page.hasChildren ? t("Encrypt section") : t("Encrypt page")}
        </Menu.Item>
      )}
      {page.isEncrypted && dek && (
        <>
          <Menu.Item
            leftSection={<IconLock size={16} />}
            onClick={() => {
              lockPageKey(page.id);
              broadcastPageLock(page.id);
            }}
          >
            {t("Lock now")}
          </Menu.Item>
          {/* the password and the ciphertext of a section are managed on its
              root page, so these actions only appear there */}
          {!page.encryptionRootId && (
            <>
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
    // prefer the live editor state over the possibly stale server copy, but
    // only when the editor really belongs to this page
    const rootContent = editorForPage(pageEditor, page.id)?.getJSON();

    let pageCount: number;
    try {
      ({ pageCount } = await encryptSection({
        pageId: page.id,
        dek: newDek,
        meta,
        rootContent,
      }));
    } catch (err) {
      notifications.show({
        message: getSectionErrorMessage(err, t),
        color: "red",
      });
      return;
    }

    unlockPageKey(page.id, newDek);
    setOpenModal(null);
    notifications.show({
      message:
        pageCount > 1
          ? t("{{count}} pages encrypted", { count: pageCount })
          : t("Page encrypted"),
    });
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
