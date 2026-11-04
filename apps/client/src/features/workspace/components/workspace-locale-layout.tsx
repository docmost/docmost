import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { startLanguage } from "@/i18n.ts";
import { rememberWorkspaceLanguage, toMemberLocale } from "@/lib/locale.ts";

// pages outside the app shell: the member's own language if this browser knows them, else the workspace default
export default function WorkspaceLocaleLayout() {
  const { i18n, ready } = useTranslation();
  const currentUser = useAtomValue(currentUserAtom);
  const { data: workspace, isLoading } = useWorkspacePublicDataQuery();
  const locale =
    toMemberLocale(currentUser?.user?.locale) || workspace?.defaultLocale;

  useEffect(() => {
    if (workspace?.defaultLocale) {
      rememberWorkspaceLanguage(workspace.defaultLocale);
    }
  }, [workspace?.defaultLocale]);

  useEffect(() => {
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  // a first visit starts without a language, so it also waits for the workspace one instead of showing English
  const languagePending =
    !ready ||
    (!startLanguage &&
      (isLoading || (locale !== undefined && locale !== i18n.language)));

  // hidden rather than unmounted, so the page's code and data load alongside the language file
  return (
    <div style={languagePending ? { opacity: 0 } : undefined}>
      <Outlet />
    </div>
  );
}
