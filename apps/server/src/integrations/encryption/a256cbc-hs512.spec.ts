import * as crypto from 'node:crypto';
import { decryptA256CbcHs512, encryptA256CbcHs512 } from './a256cbc-hs512';

// RFC 7518 Appendix B.3: independent known-answer values
const key = Buffer.from(Array.from({ length: 64 }, (_, i) => i));
const iv = Buffer.from('1af38c2dc2b96ffdd86694092341bc04', 'hex');
const plaintext = Buffer.from(
  'A cipher system must not be required to be secret, and it must be able to fall into the hands of the enemy without inconvenience',
);
const aad = Buffer.from('The second principle of Auguste Kerckhoffs');
const cipherText = Buffer.from(
  '4affaaadb78c31c5da4b1b590d10ffbd3dd8d5d302423526912da037ecbcc7bd' +
    '822c301dd67c373bccb584ad3e9279c2e6d12a1374b77f077553df829410446b' +
    '36ebd97066296ae6427ea75c2e0846a11a09ccf5370dc80bfecbad28c73f09b3' +
    'a3b75e662a2594410ae496b2e2e6609e31e6e02cc837f053d21f37ff4f51950b' +
    'be2638d09dd7a4930930806d0703b1f6',
  'hex',
);
const authTag = Buffer.from(
  '4dd3b4c088a7f45c216839645b2012bf2e6269a8c56a816dbc1b267761955bc5',
  'hex',
);

describe('A256CBC-HS512', () => {
  it('matches the RFC 7518 encryption vector', () => {
    expect(encryptA256CbcHs512(plaintext, key, iv, aad)).toEqual({
      iv,
      cipherText,
      authTag,
    });
  });

  it('decrypts the RFC 7518 ciphertext and tag', () => {
    expect(decryptA256CbcHs512({ iv, cipherText, authTag }, key, aad)).toEqual(
      plaintext,
    );
  });

  it('rejects bad authentication before invoking CBC decryption', () => {
    const decrypt = jest.spyOn(crypto, 'createDecipheriv');
    try {
      expect(() =>
        decryptA256CbcHs512(
          { iv, cipherText, authTag: Buffer.alloc(32) },
          key,
          aad,
        ),
      ).toThrow('Ciphertext authentication failed');
      expect(decrypt).not.toHaveBeenCalled();
    } finally {
      decrypt.mockRestore();
    }
  });

  it('authenticates the additional data', () => {
    expect(() =>
      decryptA256CbcHs512(
        { iv, cipherText, authTag },
        key,
        Buffer.from('other'),
      ),
    ).toThrow('Ciphertext authentication failed');
  });
});
