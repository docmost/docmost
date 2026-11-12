import { ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DatesProvider,
  DatesProviderSettings,
  DayOfWeek,
} from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

type DayjsLocale = {
  id: string;
  weekStart: DayOfWeek;
  load: () => Promise<unknown>;
};

const DEFAULT_LANGUAGE = "en-US";

const DAYJS_LOCALES: Record<string, DayjsLocale> = {
  "en-US": { id: "en", weekStart: 0, load: () => Promise.resolve() },
  "de-DE": { id: "de", weekStart: 1, load: () => import("dayjs/locale/de") },
  "es-ES": { id: "es", weekStart: 1, load: () => import("dayjs/locale/es") },
  "fr-FR": { id: "fr", weekStart: 1, load: () => import("dayjs/locale/fr") },
  "it-IT": { id: "it", weekStart: 1, load: () => import("dayjs/locale/it") },
  "ja-JP": { id: "ja", weekStart: 0, load: () => import("dayjs/locale/ja") },
  "ko-KR": { id: "ko", weekStart: 0, load: () => import("dayjs/locale/ko") },
  "nl-NL": { id: "nl", weekStart: 1, load: () => import("dayjs/locale/nl") },
  "pt-BR": { id: "pt-br", weekStart: 0, load: () => import("dayjs/locale/pt-br") },
  "ru-RU": { id: "ru", weekStart: 1, load: () => import("dayjs/locale/ru") },
  "uk-UA": { id: "uk", weekStart: 1, load: () => import("dayjs/locale/uk") },
  "zh-CN": { id: "zh-cn", weekStart: 1, load: () => import("dayjs/locale/zh-cn") },
};

function resolveDayjsLocale(language: string | undefined): DayjsLocale {
  if (language && DAYJS_LOCALES[language]) return DAYJS_LOCALES[language];
  const prefix = language?.split("-")[0].toLowerCase();
  const match = Object.keys(DAYJS_LOCALES).find(
    (key) => key.split("-")[0] === prefix,
  );
  return DAYJS_LOCALES[match ?? DEFAULT_LANGUAGE];
}

export function DatesLocaleProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState("en");
  const { weekStart } = resolveDayjsLocale(i18n.language);

  useEffect(() => {
    let stale = false;
    const { id, load } = resolveDayjsLocale(i18n.language);
    load()
      .then(() => {
        if (!stale) setLocale(id);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [i18n.language]);

  const settings = useMemo<DatesProviderSettings>(
    () => ({ locale, firstDayOfWeek: weekStart, consistentWeeks: true }),
    [locale, weekStart],
  );

  return <DatesProvider settings={settings}>{children}</DatesProvider>;
}
