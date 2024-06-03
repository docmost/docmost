import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import React, { useEffect } from "react";
import useCurrentUser from "@/features/user/hooks/use-current-user";

export function UserProvider({ children }: React.PropsWithChildren) {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const { data, isLoading, error } = useCurrentUser();

  useEffect(() => {
    if (data && data.user && data.workspace) {
      setCurrentUser(data);
    }
  }, [data, isLoading]);

  if (isLoading) return <></>;

  if (!data.user && !data.workspace) return <></>;

  if (error) {
    return <>an error occurred</>;
  }

  return <>{children}</>;
}
