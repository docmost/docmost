import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { BillingPlan } from "@/ee/billing/types/billing.types.ts";

export const usePlan = () => {
  const [workspace] = useAtom(workspaceAtom);

  const isStandard =
    typeof workspace?.plan === "string" &&
    workspace?.plan.toLowerCase() === BillingPlan.STANDARD.toLowerCase();

  return { isStandard };
};

export default usePlan;
