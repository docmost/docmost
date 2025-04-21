import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";

export const useLicense = () => {
  const [currentUser] = useAtom(currentUserAtom);
  return { hasLicenseKey: currentUser?.workspace?.hasLicenseKey };
};

export default useLicense;
