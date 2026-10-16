import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DatesProvider,
  DatesProviderSettings,
  DayOfWeek,
} from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

type DayjsLocale = { id: string; load: () => Promise<unknown> };

const DEFAULT_LANGUAGE = "en-US";

const DAYJS_LOCALES: Record<string, DayjsLocale> = {
  "en-US": { id: "en", load: () => Promise.resolve() },
  "de-DE": { id: "de", load: () => import("dayjs/locale/de") },
  "es-ES": { id: "es", load: () => import("dayjs/locale/es") },
  "fr-FR": { id: "fr", load: () => import("dayjs/locale/fr") },
  "it-IT": { id: "it", load: () => import("dayjs/locale/it") },
  "ja-JP": { id: "ja", load: () => import("dayjs/locale/ja") },
  "ko-KR": { id: "ko", load: () => import("dayjs/locale/ko") },
  "nl-NL": { id: "nl", load: () => import("dayjs/locale/nl") },
  "pt-BR": { id: "pt-br", load: () => import("dayjs/locale/pt-br") },
  "ru-RU": { id: "ru", load: () => import("dayjs/locale/ru") },
  "uk-UA": { id: "uk", load: () => import("dayjs/locale/uk") },
  "zh-CN": { id: "zh-cn", load: () => import("dayjs/locale/zh-cn") },
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
  const [settings, setSettings] = useState<DatesProviderSettings>({
    locale: "en",
    firstDayOfWeek: 0,
    consistentWeeks: true,
  });

  useEffect(() => {
    let stale = false;
    const { id, load } = resolveDayjsLocale(i18n.language);
    load()
      .then(() => {
        if (stale) return;
        setSettings({
          locale: id,
          firstDayOfWeek: (dayjs.Ls[id]?.weekStart ?? 0) as DayOfWeek,
          consistentWeeks: true,
        });
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [i18n.language]);

  return <DatesProvider settings={settings}>{children}</DatesProvider>;
}
