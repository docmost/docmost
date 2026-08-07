import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const nanoIdGen = customAlphabet(alphabet, 10);

const slugIdAlphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const generateSlugId = customAlphabet(slugIdAlphabet, 10);

const baseIdSuffix = customAlphabet(alphabet, 9);

export const generateBasePropertyId = (): string => `prp${baseIdSuffix()}`;
export const generateBaseChoiceId = (): string => `opt${baseIdSuffix()}`;
