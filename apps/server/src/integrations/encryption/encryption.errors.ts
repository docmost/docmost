export class UnableToInitialize extends Error {
  constructor(message: string) {
    super(`Unable to initialize the encryption service: ${message}`);
    this.name = 'UnableToInitialize';
  }
}

export class UnableToDecrypt extends Error {
  constructor(reason: string) {
    super(`Unable to decrypt the ciphertext: ${reason}`);
    this.name = 'UnableToDecrypt';
  }
}
