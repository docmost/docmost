import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { isCloud } from "@/lib/config";

export function useUpgradeLabel(): string {
  const { t } = useTranslation();
  const [entitlements] = useAtom(entitlementAtom);

  if (!isCloud()) {
    return entitlements != null && entitlements.tier !== "free"
      ? t("Upgrade your license tier.")
      : t("Available with a paid license");
  }
  return t("Upgrade your plan");
}
