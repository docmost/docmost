import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { isCloud } from "@/lib/config";

export function useUpgradeLabel(): string {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);

  if (!isCloud()) {
    return workspace?.hasLicenseKey
      ? t("Upgrade your license tier.")
      : t("Available with a paid license");
  }
  return t("Upgrade your plan");
}
