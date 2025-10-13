import { useEffect, useState } from "react";
import { getOidcStatus, getOidcLoginUrl } from "../services/oidc-service";
import { useLocation } from "react-router-dom";

export function useOidcAutoRedirect() {
  const [isChecking, setIsChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkOidcAndRedirect = async () => {
      try {
        // Check if we're coming back from an error
        const params = new URLSearchParams(location.search);
        if (params.get("error")) {
          setIsChecking(false);
          return;
        }

        const status = await getOidcStatus();
        
        if (status.enabled) {
          // Redirect to OIDC login
          window.location.href = getOidcLoginUrl();
          return;
        }
      } catch (error) {
        console.error("Failed to check OIDC status:", error);
      }
      
      setIsChecking(false);
    };

    checkOidcAndRedirect();
  }, [location.search]);

  return { isChecking };
}
