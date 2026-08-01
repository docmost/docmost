import { useEffect, useState } from "react";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { Alert, Center, Loader } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import {
  decryptBytes,
  sectionAad,
} from "@/features/encryption/services/crypto";
import { decodeBlob } from "@/features/encryption/services/encrypted-blob";
import { getEncryptedBlob } from "@/features/encryption/services/encryption-service";
import {
  markPageEncrypted,
  unmarkPageEncrypted,
} from "@/features/encryption/services/encrypted-pages";
import DecryptedEditor from "@/features/editor/encrypted/decrypted-editor";

interface BlobLoaderProps {
  pageId: string;
  sectionId: string;
  dek: CryptoKey;
  editable: boolean;
  /** clear the vault entry and re-prompt when decrypt fails with the current key */
  onDecryptFailed?: () => void;
}

interface LoadedState {
  ydoc: Y.Doc;
  awareness: Awareness;
  // true when the stored blob was legacy v1 JSON and the Y.Doc was locally
  // seeded from it — the seed must be re-saved in the v2 ydoc format
  needsMigration: boolean;
  version: number;
  // identifies which key produced this state, so a key identity change
  // never leaves the editor mounted on a stale/destroyed doc
  dek: CryptoKey;
}

/**
 * Fetches an encrypted page's blob and decrypts it into a Y.Doc before the
 * editor mounts.
 *
 * The decrypted content only ever lives in this component's state — it is
 * never written to the TanStack Query cache or any browser storage, and it is
 * discarded as soon as the page locks or the component unmounts.
 */
export default function BlobLoader({
  pageId,
  sectionId,
  dek,
  editable,
  onDecryptFailed,
}: BlobLoaderProps) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  // a flag rather than a message: keeping the wording out of the effect keeps
  // `t` out of its dependencies, so switching language cannot re-fetch and
  // re-decrypt the page
  const [loadFailed, setLoadFailed] = useState(false);

  // Refuse file uploads for as long as this page is open (see encrypted-pages).
  useEffect(() => {
    markPageEncrypted(pageId);
    return () => unmarkPageEncrypted(pageId);
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    let ydoc: Y.Doc | null = null;
    let awareness: Awareness | null = null;
    (async () => {
      try {
        const blob = await getEncryptedBlob(pageId);
        if (cancelled) return;
        ydoc = new Y.Doc();
        awareness = new Awareness(ydoc);
        if (!blob.encryptedBlob) {
          setLoaded({
            ydoc,
            awareness,
            needsMigration: false,
            version: blob.version,
            dek,
          });
          return;
        }
        const bytes = await decryptBytes(
          dek,
          blob.encryptedBlob,
          sectionAad(sectionId),
        );
        if (cancelled) return;
        const decoded = decodeBlob(bytes);
        if (decoded.kind === "ydoc") {
          Y.applyUpdate(ydoc, decoded.update);
          setLoaded({
            ydoc,
            awareness,
            needsMigration: false,
            version: blob.version,
            dek,
          });
        } else {
          // legacy v1 JSON blob: seed the Y.Doc BEFORE the editor mounts —
          // replacing a live collaborative doc via setContent crashes the
          // placeholder extension's position resolution
          const seededDoc = prosemirrorJSONToYDoc(
            getSchema(mainExtensions),
            decoded.content,
            "default",
          );
          Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(seededDoc));
          seededDoc.destroy();
          setLoaded({
            ydoc,
            awareness,
            needsMigration: true,
            version: blob.version,
            dek,
          });
        }
      } catch (err) {
        if (!cancelled) {
          // Prefer handing control back to the unlock flow over a dead-end
          // alert: without clearing the vault the user can be stuck on a
          // key that will never open this content (see storeKey).
          if (onDecryptFailed) {
            onDecryptFailed();
          } else {
            setLoadFailed(true);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      // Drop loaded so DecryptedEditor unmounts (provider.destroy runs in
      // its cleanup). Destroy the doc on the next task so React can finish
      // that unmount first — flushSync is illegal during lifecycle methods.
      setLoaded(null);
      const awarenessToDestroy = awareness;
      const ydocToDestroy = ydoc;
      setTimeout(() => {
        awarenessToDestroy?.destroy();
        ydocToDestroy?.destroy();
      }, 0);
    };
  }, [pageId, sectionId, dek, onDecryptFailed]);

  if (loadFailed) {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle size={16} />}
        title={t("Decryption failed")}
      >
        {t("Failed to decrypt page content. Please try unlocking again.")}
      </Alert>
    );
  }

  // loaded.dek !== dek covers the render window after a key identity change
  // but before the load effect replaces the state — the old ydoc may already
  // be scheduled for destruction and must not stay mounted
  if (!loaded || loaded.dek !== dek) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <DecryptedEditor
      pageId={pageId}
      sectionId={sectionId}
      dek={dek}
      editable={editable}
      ydoc={loaded.ydoc}
      awareness={loaded.awareness}
      needsMigration={loaded.needsMigration}
      initialVersion={loaded.version}
    />
  );
}
