import { isCloud } from "@/lib/config";
import { useLicense } from "@/ee/hooks/use-license";
import { useAtom } from "jotai/index";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import usePlan from "@/ee/hooks/use-plan";

export const useIsCloudEE = () => {
  const { hasLicenseKey } = useLicense();
  return isCloud() || !!hasLicenseKey;
};

export const useIsEEOnly = () => {
  const { hasLicenseKey } = useLicense();
  const { isBusiness } = usePlan();
  return (isCloud() && isBusiness) || !!hasLicenseKey;
};
