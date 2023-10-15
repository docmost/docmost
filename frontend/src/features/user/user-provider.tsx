'use client';

import { useAtom } from 'jotai';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import React, { useEffect } from 'react';
import useCurrentUser from '@/features/user/hooks/use-current-user';

export function UserProvider({ children }: React.PropsWithChildren) {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const { data, isLoading, error } = useCurrentUser();

  useEffect(() => {
    if (data && data.user) {
      setCurrentUser(data);
    }
  }, [data, isLoading, setCurrentUser]);

  if (isLoading) return <></>;

  if (error) {
    return <>an error occurred</>;
  }

  return <>{children}</>;
}
