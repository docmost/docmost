import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { login, register } from "@/features/auth/services/auth-service";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { authTokensAtom } from "@/features/auth/atoms/auth-tokens-atom";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { ILogin, IRegister } from "@/features/auth/types/auth.types";
import { RESET } from "jotai/vanilla/utils/constants";

export default function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [authToken, setAuthToken] = useAtom(authTokensAtom);

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      const res = await login(data);
      setIsLoading(false);
      await setAuthToken(res.tokens);

      router.push("/home");
    } catch (err) {
      setIsLoading(false);
      toast({
        description: err.response?.data.message,
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (data: IRegister) => {
    setIsLoading(true);

    try {
      const res = await register(data);
      setIsLoading(false);

      await setAuthToken(res.tokens);

      router.push("/home");
    } catch (err) {
      setIsLoading(false);
      toast({
        description: err.response?.data.message,
        variant: "destructive",
      });
    }
  };

  const hasTokens = () => {
    return !!authToken;
  };

  const handleLogout = async () => {
    await setAuthToken(RESET);
    setCurrentUser('');
  }

  return { signIn: handleSignIn, signUp: handleSignUp, isLoading, hasTokens };
}
