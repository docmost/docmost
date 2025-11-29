import { isCloud } from "@/lib/config";
import { useLicense } from "@/ee/hooks/use-license";

export const useIsCloudEE = () => {
  const { hasLicenseKey } = useLicense();
  return isCloud() || !!hasLicenseKey;
}; 