import { cleanup, render, waitFor } from "@testing-library/react";
import { useDatesContext } from "@mantine/dates";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

const language = vi.hoisted(() => ({ current: "en-US" }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: language.current },
  }),
}));

import { DatesLocaleProvider } from "./dates-locale-provider";

type Recorded = { firstDayOfWeek: number; locale: string };

function Recorder({ records }: { records: Recorded[] }) {
  const ctx = useDatesContext();
  records.push({ firstDayOfWeek: ctx.getFirstDayOfWeek(), locale: ctx.getLocale() });
  return null;
}

function renderWith(lang: string) {
  language.current = lang;
  const records: Recorded[] = [];
  const view = render(
    <DatesLocaleProvider>
      <Recorder records={records} />
    </DatesLocaleProvider>,
  );
  return { records, view };
}

const LANGUAGES: [string, string][] = [
  ["en-US", "en"],
  ["de-DE", "de"],
  ["es-ES", "es"],
  ["fr-FR", "fr"],
  ["it-IT", "it"],
  ["ja-JP", "ja"],
  ["ko-KR", "ko"],
  ["nl-NL", "nl"],
  ["pt-BR", "pt-br"],
  ["ru-RU", "ru"],
  ["uk-UA", "uk"],
  ["zh-CN", "zh-cn"],
];
const DAYJS_IDS = Object.fromEntries(LANGUAGES);

afterEach(cleanup);

describe("DatesLocaleProvider", () => {
  it("starts the week on Monday for German from the first render", async () => {
    const { records } = renderWith("de-DE");
    await waitFor(() => expect(records.at(-1)?.locale).toBe("de"));
    expect(records.map((r) => r.firstDayOfWeek)).toEqual(records.map(() => 1));
  });

  it.each(["en-US", "ja-JP", "ko-KR", "pt-BR"])("starts the week on Sunday for %s", async (lang) => {
    const { records } = renderWith(lang);
    await waitFor(() => expect(records.at(-1)?.locale).toBe(DAYJS_IDS[lang]));
    expect(records.every((r) => r.firstDayOfWeek === 0)).toBe(true);
  });

  it.each(["fr-FR", "nl-NL", "ru-RU", "uk-UA", "zh-CN", "es-ES", "it-IT"])(
    "starts the week on Monday for %s",
    async (lang) => {
      const { records } = renderWith(lang);
      await waitFor(() => expect(records.at(-1)?.locale).toBe(DAYJS_IDS[lang]));
      expect(records.every((r) => r.firstDayOfWeek === 1)).toBe(true);
    },
  );

  it.each(LANGUAGES)("matches the dayjs week start for %s once its locale has loaded", async (lang, id) => {
    const { records } = renderWith(lang);
    await waitFor(() => expect(records.at(-1)?.locale).toBe(id));
    expect(records.at(-1)?.firstDayOfWeek).toBe(dayjs.Ls[id]?.weekStart ?? 0);
  });

  it("changes the week start in the same render as the language", async () => {
    const { records, view } = renderWith("en-US");
    await waitFor(() => expect(records.at(-1)?.locale).toBe("en"));
    expect(records.at(-1)?.firstDayOfWeek).toBe(0);
    const before = records.length;
    language.current = "de-DE";
    view.rerender(
      <DatesLocaleProvider>
        <Recorder records={records} />
      </DatesLocaleProvider>,
    );
    expect(records.length).toBeGreaterThan(before);
    expect(records[before].firstDayOfWeek).toBe(1);
    await waitFor(() => expect(records.at(-1)?.locale).toBe("de"));
  });

  it("sets the dayjs locale id once the locale file has loaded", async () => {
    const { records } = renderWith("de-DE");
    await waitFor(() => expect(records.at(-1)?.locale).toBe("de"));
  });
});
