export interface EncryptionMeta {
  algo: string;
  kdf: string;
  iterations: number;
  salt: string;
  wrappedDek: string;
  dekCheck: string;
}

export class WrongPasswordError extends Error {
  constructor(message = "Wrong password") {
    super(message);
    this.name = "WrongPasswordError";
  }
}
