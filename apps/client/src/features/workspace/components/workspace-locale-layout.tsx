import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";

// pages outside the app shell: the member's own language if this browser knows them, else the workspace default
export default function WorkspaceLocaleLayout() {
  const { i18n } = useTranslation();
  const currentUser = useAtomValue(currentUserAtom);
  const { data: workspace } = useWorkspacePublicDataQuery();
  const userLocale = currentUser?.user?.locale;
  const locale =
    (userLocale === "en" ? "en-US" : userLocale) || workspace?.defaultLocale;

  useEffect(() => {
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return <Outlet />;
}
