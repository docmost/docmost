// eslint-disable-next-line @typescript-eslint/no-require-imports
const { customAlphabet } = require('fix-esm').require('nanoid');

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const nanoIdGen = customAlphabet(alphabet, 10);

const slugIdAlphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const generateSlugId = customAlphabet(slugIdAlphabet, 10);
