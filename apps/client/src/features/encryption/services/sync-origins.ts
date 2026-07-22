// Yjs transaction origins used by the encrypted-page sync layers. Every
// non-local origin is skipped by the broadcast hooks so that updates are
// forwarded exactly once: each tab has its own relay connection, so nothing
// received from a sibling tab, the relay, or a 409 merge is re-sent.
export const TAB_SYNC_ORIGIN = "e2ee-tab-sync";
export const RELAY_ORIGIN = "e2ee-relay";
export const MERGE_ORIGIN = "e2ee-merge";

export function isRemoteOrigin(origin: unknown): boolean {
  return (
    origin === TAB_SYNC_ORIGIN ||
    origin === RELAY_ORIGIN ||
    origin === MERGE_ORIGIN
  );
}
