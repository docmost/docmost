import { useCallback, useState } from "react";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import {
  broadcastPageLock,
  useLockPageKey,
  usePageKey,
  useUnlockPageKey,
} from "@/features/encryption/hooks/page-key-store";
import { UnlockPageModal } from "@/features/encryption/components/unlock-page-modal";
import { LockedPageScreen } from "@/features/encryption/components/locked-page-screen";
import BlobLoader from "@/features/editor/encrypted/blob-loader";

interface EncryptedPageEditorProps {
  pageId: string;
  pageTitle?: string;
  encryptionMeta: EncryptionMeta;
  /** set when this page is keyed to an encrypted section's root */
  encryptionRootId?: string | null;
  editable: boolean;
}

/**
 * Entry point for an encrypted page: shows the locked screen until the
 * section key is in this tab's vault, then hands off to BlobLoader.
 *
 * The key is never shared between tabs — each one prompts for the password
 * itself — so a script running in the page cannot obtain a key by asking a
 * sibling tab for it.
 */
export default function EncryptedPageEditor({
  pageId,
  pageTitle,
  encryptionMeta,
  encryptionRootId,
  editable,
}: EncryptedPageEditorProps) {
  const dek = usePageKey(pageId);
  const unlockPageKey = useUnlockPageKey();
  const lockPageKey = useLockPageKey();
  const [unlockOpened, setUnlockOpened] = useState(false);
  // the key belongs to the section, so store and fetch it under the section's
  // id rather than relying on the page→section index being populated first
  const sectionId = encryptionRootId ?? pageId;

  const handleDecryptFailed = useCallback(() => {
    // Drop the vault entry so this component remounts the locked screen.
    // A stale DEK (re-keyed section, corrupt blob, wrong mapping) has no
    // recovery path while storeKey refuses to replace an existing key.
    lockPageKey(sectionId);
    broadcastPageLock(sectionId);
    setUnlockOpened(true);
  }, [lockPageKey, sectionId]);

  if (!dek) {
    return (
      <>
        <LockedPageScreen
          pageTitle={pageTitle}
          onUnlockClick={() => setUnlockOpened(true)}
        />
        <UnlockPageModal
          opened={unlockOpened}
          onClose={() => setUnlockOpened(false)}
          encryptionMeta={encryptionMeta}
          pageTitle={pageTitle}
          onUnlocked={(unlockedDek) => {
            unlockPageKey(sectionId, unlockedDek);
            setUnlockOpened(false);
          }}
        />
      </>
    );
  }

  return (
    <BlobLoader
      pageId={pageId}
      sectionId={sectionId}
      dek={dek}
      editable={editable}
      onDecryptFailed={handleDecryptFailed}
    />
  );
}
