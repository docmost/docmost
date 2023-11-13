import { useState } from 'react';
import { login, register } from '@/features/auth/services/auth-service';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authTokensAtom } from '@/features/auth/atoms/auth-tokens-atom';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { ILogin, IRegister } from '@/features/auth/types/auth.types';
import { notifications } from '@mantine/notifications';

export default function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [authToken, setAuthToken] = useAtom(authTokensAtom);

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      const res = await login(data);
      setIsLoading(false);
      setAuthToken(res.tokens);

      navigate('/home');
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: 'red',
      });
    }
  };

  const handleSignUp = async (data: IRegister) => {
    setIsLoading(true);

    try {
      const res = await register(data);
      setIsLoading(false);

      setAuthToken(res.tokens);

      navigate('/home');
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: 'red',
      });
    }
  };

  const hasTokens = () => {
    return !!authToken;
  };

  const handleLogout = async () => {
    setAuthToken(null);
    setCurrentUser(null);
  };

  return { signIn: handleSignIn, signUp: handleSignUp, isLoading, hasTokens };
}
