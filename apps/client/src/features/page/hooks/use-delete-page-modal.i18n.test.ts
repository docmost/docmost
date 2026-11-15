import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import i18next from "i18next";
import { describe, expect, it } from "vitest";

const RETENTION_KEY =
  "Pages in trash are permanently deleted after {{count}} days.";

const localesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../public/locales",
);

function readLocale(locale: string) {
  return JSON.parse(
    fs.readFileSync(path.join(localesDir, locale, "translation.json"), "utf8"),
  );
}

async function translator(locale: string) {
  const instance = i18next.createInstance();
  await instance.init({
    lng: locale,
    fallbackLng: "en-US",
    resources: {
      [locale]: { translation: readLocale(locale) },
      "en-US": { translation: readLocale("en-US") },
    },
    interpolation: { escapeValue: false },
  });
  return instance.t.bind(instance);
}

describe("move to trash retention sentence", () => {
  it("uses the singular for one day", async () => {
    const t = await translator("en-US");

    expect(t(RETENTION_KEY, { count: 1 })).toBe(
      "Pages in trash are permanently deleted after 1 day.",
    );
    expect(t(RETENTION_KEY, { count: 30 })).toBe(
      "Pages in trash are permanently deleted after 30 days.",
    );
  });

  // react-i18next has no ICU support here, so ICU plural syntax in a
  // translation would be shown to users as is
  it.each(fs.readdirSync(localesDir))(
    "renders plain text with the day count in %s",
    async (locale) => {
      const t = await translator(locale);
      const text = t(RETENTION_KEY, { count: 7 });

      expect(text).not.toMatch(/\{\s*count\s*,/);
      expect(text).toContain("7");
    },
  );
});
