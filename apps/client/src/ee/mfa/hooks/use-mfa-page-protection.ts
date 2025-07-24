import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route";
import { validateMfaAccess } from "@/ee/mfa";

export function useMfaPageProtection() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const result = await validateMfaAccess();

      if (!result.valid) {
        navigate(APP_ROUTE.AUTH.LOGIN);
        return;
      }

      // Check if user is on the correct page based on their MFA state
      const isOnChallengePage =
        location.pathname === APP_ROUTE.AUTH.MFA_CHALLENGE;
      const isOnSetupPage =
        location.pathname === APP_ROUTE.AUTH.MFA_SETUP_REQUIRED;

      if (result.requiresMfaSetup && !isOnSetupPage) {
        // User needs to set up MFA but is on challenge page
        navigate(APP_ROUTE.AUTH.MFA_SETUP_REQUIRED);
      } else if (
        !result.requiresMfaSetup &&
        result.userHasMfa &&
        !isOnChallengePage
      ) {
        // User has MFA and should be on challenge page
        navigate(APP_ROUTE.AUTH.MFA_CHALLENGE);
      } else if (!result.isTransferToken) {
        // User has a regular auth token, shouldn't be on MFA pages
        navigate(APP_ROUTE.HOME);
      } else {
        setIsValid(true);
      }

      setIsValidating(false);
    };

    checkAccess();
  }, [navigate, location.pathname]);

  return { isValidating, isValid };
}
