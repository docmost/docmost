import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { getTrialDaysLeft } from "@/ee/billing/utils.ts";
import { ICurrentUser } from "@/features/user/types/user.types.ts";

export const useTrial = () => {
  const [currentUser] = useAtom<ICurrentUser>(currentUserAtom);
  const workspace = currentUser?.workspace;

  const trialDaysLeft = getTrialDaysLeft(workspace?.trialEndAt);
  const isTrial = !!workspace?.trialEndAt && trialDaysLeft !== null;

  return { isTrial: isTrial, trialDaysLeft: trialDaysLeft };
};

export default useTrial;
