import { LANGUAGE_OPTIONS } from "@/lib/constants.ts";

const WORKSPACE_LOCALE_KEY = "workspaceLocale";

function isShipped(locale: unknown): locale is string {
  return LANGUAGE_OPTIONS.some((option) => option.value === locale);
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredMemberLocale(): unknown {
  try {
    // persisted by currentUserAtom
    return JSON.parse(readStorage("currentUser") ?? "null")?.user?.locale;
  } catch {
    return undefined;
  }
}

// older accounts store "en"
export function toMemberLocale(locale: unknown): string | undefined {
  const value = locale === "en" ? "en-US" : locale;
  return isShipped(value) ? value : undefined;
}

// the member this browser knows, else the language the server put in the page, else the workspace language from an earlier visit
export function getStartLanguage(): string | undefined {
  return [
    toMemberLocale(readStoredMemberLocale()),
    document.documentElement.lang,
    readStorage(WORKSPACE_LOCALE_KEY),
  ].find(isShipped);
}

export function rememberWorkspaceLanguage(locale: string) {
  try {
    localStorage.setItem(WORKSPACE_LOCALE_KEY, locale);
  } catch {
    // storage is blocked, so the next visit waits for the workspace language again
  }
}
