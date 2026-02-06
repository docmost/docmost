import { isCloud } from "@/lib/config";
import useLicense from "@/ee/hooks/use-license";
import usePlan from "@/ee/hooks/use-plan";

const useEnterpriseAccess = () => {
  const { hasLicenseKey } = useLicense();
  const { isBusiness } = usePlan();

  return (isCloud() && isBusiness) || (!isCloud() && hasLicenseKey);
};

export default useEnterpriseAccess;
