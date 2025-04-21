import { useEffect } from "react";
import useCurrentUser from "@/features/user/hooks/use-current-user.ts";
import APP_ROUTE from "@/lib/app-route.ts";
import { useNavigate } from "react-router-dom";

export function useRedirectIfAuthenticated() {
  const { data, isLoading } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (data && data?.user) {
      navigate(APP_ROUTE.HOME);
    }
  }, [isLoading, data]);
}
