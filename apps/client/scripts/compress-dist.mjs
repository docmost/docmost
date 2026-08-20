import { promises as fs } from "node:fs";
import { join, extname } from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const DIST = new URL("../dist", import.meta.url).pathname;
// index.html is rewritten by the server at boot, so html must not be precompressed
const COMPRESSIBLE = new Set([".js", ".css", ".svg", ".json", ".txt", ".map"]);
const MIN_SIZE = 1024;

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const files = [];
for await (const file of walk(DIST)) {
  if (!COMPRESSIBLE.has(extname(file))) continue;
  const { size } = await fs.stat(file);
  if (size >= MIN_SIZE) files.push(file);
}

await Promise.all(
  files.map(async (file) => {
    const content = await fs.readFile(file);
    const [gz, br] = await Promise.all([
      gzip(content, { level: 9 }),
      brotli(content, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length,
        },
      }),
    ]);
    await Promise.all([
      fs.writeFile(`${file}.gz`, gz),
      fs.writeFile(`${file}.br`, br),
    ]);
  }),
);

console.log(`precompressed ${files.length} assets (.gz/.br)`);
