// Yjs transaction origins used by the encrypted-page sync layers. Every
// non-local origin is skipped by the broadcast hooks so that updates are
// forwarded exactly once: nothing received from the relay or applied by a
// 409 merge is re-sent. Sibling tabs are ordinary relay peers — they hold
// their own key and their own connection, and never exchange plaintext.
export const RELAY_ORIGIN = "e2ee-relay";
export const MERGE_ORIGIN = "e2ee-merge";

export function isRemoteOrigin(origin: unknown): boolean {
  return origin === RELAY_ORIGIN || origin === MERGE_ORIGIN;
}
