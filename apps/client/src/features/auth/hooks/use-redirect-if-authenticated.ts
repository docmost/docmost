import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "@/features/auth/hooks/use-auth.ts";

export function useRedirectIfAuthenticated() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const validAuth = await isAuthenticated();
      if (validAuth) {
        navigate("/home");
      }
    };

    checkAuth();
  }, [isAuthenticated]);
}
