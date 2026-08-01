export interface EncryptionMeta {
  /**
   * Format version of this metadata. Absent on sections created before
   * versioning; treated as 1. Bump only when the *shape* of the metadata
   * changes — the primitives themselves are named by `algo` and `kdf`.
   */
  version?: number;
  algo: string;
  kdf: string;
  iterations: number;
  salt: string;
  wrappedDek: string;
  dekCheck: string;
}
