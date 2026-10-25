import * as React from 'react';
import * as enUS from './en-US.json';
import * as koKR from './ko-KR.json';

export type EmailTranslationKey = Exclude<keyof typeof enUS, 'default'>;

type EmailTranslations = Partial<Record<EmailTranslationKey, string>>;

export const DEFAULT_EMAIL_LOCALE = 'en-US';

const resources: Record<string, EmailTranslations> = {
  'en-US': enUS,
  'ko-KR': koKR,
};

const PLACEHOLDER = /{{\s*(\w+)\s*}}/g;

export interface EmailTranslator {
  locale: string;
  t: (
    key: EmailTranslationKey,
    vars?: Record<string, string | number>,
  ) => string;
  // like t(), but placeholders may be React nodes (e.g. <strong>{name}</strong>)
  rich: (
    key: EmailTranslationKey,
    vars: Record<string, React.ReactNode>,
  ) => React.ReactElement;
}

export function normalizeEmailLocale(locale?: string | null): string {
  if (!locale) return DEFAULT_EMAIL_LOCALE;
  if (resources[locale]) return locale;

  const language = locale.toLowerCase().split(/[-_]/)[0];
  const match = Object.keys(resources).find(
    (supported) => supported.toLowerCase().split('-')[0] === language,
  );
  return match ?? DEFAULT_EMAIL_LOCALE;
}

export function getEmailTranslator(locale?: string | null): EmailTranslator {
  const resolvedLocale = normalizeEmailLocale(locale);

  const lookup = (key: EmailTranslationKey): string =>
    resources[resolvedLocale][key] ??
    resources[DEFAULT_EMAIL_LOCALE][key] ??
    key;

  const t: EmailTranslator['t'] = (key, vars) =>
    lookup(key).replace(PLACEHOLDER, (match, name: string) =>
      vars && name in vars ? String(vars[name]) : match,
    );

  const rich: EmailTranslator['rich'] = (key, vars) => {
    // split() with a capture group yields [text, name, text, name, ...]
    const parts = lookup(key).split(new RegExp(PLACEHOLDER.source));
    const children = parts
      .map((part, index) => {
        if (index % 2 === 0) return part;
        return part in vars ? vars[part] : `{{${part}}}`;
      })
      .filter((child) => child !== '');
    return React.createElement(React.Fragment, null, ...children);
  };

  return { locale: resolvedLocale, t, rich };
}
