import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCloud } from "@/lib/config.ts";
import APP_ROUTE from "@/lib/app-route.ts";
import { getTrialDaysLeft } from "@/ee/billing/utils.ts";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { notifications } from "@mantine/notifications";

export const useTrialEnd = () => {
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const [workspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    if (isCloud() && getTrialDaysLeft(workspace?.trialEndAt) === 0) {
      if (!pathname.startsWith("/settings")) {
        notifications.show({
          position: "top-right",
          color: "red",
          title: "Your 14-day trial has ended",
          message:
            "Please upgrade to a paid plan or contact your workspace admin.",
          autoClose: false,
        });

        // only admins can access the billing page
        if (isAdmin) {
          navigate(APP_ROUTE.SETTINGS.WORKSPACE.BILLING);
        } else {
          navigate(APP_ROUTE.SETTINGS.ACCOUNT.PROFILE);
        }
      }
    }
  }, [navigate]);
};
