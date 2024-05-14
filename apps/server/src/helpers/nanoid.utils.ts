// eslint-disable-next-line @typescript-eslint/no-var-requires
const { customAlphabet } = require('fix-esm').require('nanoid');

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const nanoIdGen = customAlphabet(alphabet, 10);
