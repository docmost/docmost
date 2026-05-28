import { format as dateFnsFormat, type Locale } from "date-fns";
import {
  de,
  enUS,
  es,
  fr,
  it,
  ja,
  ko,
  nl,
  ptBR,
  ru,
  uk,
  zhCN,
} from "date-fns/locale";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n.ts";

const LOCALE_MAP: Record<string, Locale> = {
  "de-DE": de,
  "en-US": enUS,
  "es-ES": es,
  "fr-FR": fr,
  "it-IT": it,
  "ja-JP": ja,
  "ko-KR": ko,
  "nl-NL": nl,
  "pt-BR": ptBR,
  "ru-RU": ru,
  "uk-UA": uk,
  "zh-CN": zhCN,
};

export function getDateFnsLocale(language?: string): Locale {
  const lang = language ?? i18n.language ?? "en-US";
  return LOCALE_MAP[lang] ?? LOCALE_MAP[lang.split("-")[0]] ?? enUS;
}

export function useDateFnsLocale(): Locale {
  const { i18n: instance } = useTranslation();
  return getDateFnsLocale(instance.language);
}

function isEnglishLocale(locale: Locale): boolean {
  return locale.code === "en-US" || locale.code?.startsWith("en") === true;
}

/**
 * Picks `enUSPattern` for the English locale and `localizedPattern` for every
 * other locale. Keeps existing en-US output byte-identical while letting other
 * languages use date-fns localized format tokens (P, PP, p, PPp, …).
 */
export function formatLocalized(
  date: Date | number | string,
  enUSPattern: string,
  localizedPattern: string,
  locale?: Locale,
): string {
  const effective = locale ?? getDateFnsLocale();
  const pattern = isEnglishLocale(effective) ? enUSPattern : localizedPattern;
  return dateFnsFormat(new Date(date), pattern, { locale: effective });
}
