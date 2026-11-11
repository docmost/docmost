import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";

export function useExportDisabled(spaceIdOrSlug: string | undefined): {
  exportDisabled: boolean;
  exportDisabledLabel: string | null;
} {
  const { t } = useTranslation();
  const workspace = useAtomValue(workspaceAtom);
  const { data: space } = useGetSpaceBySlugQuery(spaceIdOrSlug);

  if (workspace?.settings?.export?.disabled === true) {
    return {
      exportDisabled: true,
      exportDisabledLabel: t(
        "Export has been disabled at the workspace level.",
      ),
    };
  }

  if (space?.settings?.export?.disabled === true) {
    return {
      exportDisabled: true,
      exportDisabledLabel: t("Export has been disabled for this space."),
    };
  }

  return { exportDisabled: false, exportDisabledLabel: null };
}
