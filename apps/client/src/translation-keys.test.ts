import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// en-US/translation.json is the source file Crowdin translates from, so a
// string missing there stays in English for every language.
const srcDir = path.dirname(fileURLToPath(import.meta.url));
const sourceFile = path.resolve(
  srcDir,
  "../public/locales/en-US/translation.json",
);

// t("..."), t('...') and t(`...`) without interpolation
const TRANSLATE_CALL = /\bt\(\s*(["'`])((?:\\.|(?!\1).)*?)\1\s*[,)]/gs;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)
      ? [entryPath]
      : [];
  });
}

function translationKeys(code: string): string[] {
  return [...code.matchAll(TRANSLATE_CALL)]
    .filter(([, quote, key]) => quote !== "`" || !key.includes("${"))
    .map(([, , key]) => key.replace(/\\(["'`\\])/g, "$1"));
}

describe("en-US translation source", () => {
  it("has every string the client translates", () => {
    const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
    const inSource = (key: string) =>
      key in source || `${key}_one` in source || `${key}_other` in source;

    const missing = new Map<string, string>();
    for (const file of sourceFiles(srcDir)) {
      for (const key of translationKeys(fs.readFileSync(file, "utf8"))) {
        if (!inSource(key) && !missing.has(key)) {
          missing.set(key, path.relative(srcDir, file));
        }
      }
    }

    expect(
      [...missing].map(([key, file]) => `${JSON.stringify(key)} (${file})`),
    ).toEqual([]);
  });
});
