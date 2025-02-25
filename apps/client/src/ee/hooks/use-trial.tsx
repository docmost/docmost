import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { getTrialDaysLeft } from "@/ee/billing/utils.ts";

export const useTrial = () => {
  const [workspace] = useAtom(workspaceAtom);
  const isTrial = !!workspace?.trialEndAt;
  const trialsDaysLeft = getTrialDaysLeft(workspace?.trialEndAt);

  return { isTrial, trialsDaysLeft };
};

export default useTrial;
