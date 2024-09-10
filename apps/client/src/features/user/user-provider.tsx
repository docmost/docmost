import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import React, { useEffect } from "react";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useTranslation } from "react-i18next";

export function UserProvider({ children }: React.PropsWithChildren) {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const { data, isLoading, error } = useCurrentUser();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (data && data.user && data.workspace) {
      setCurrentUser(data);
      i18n.changeLanguage(
        data.user?.settings?.preferences?.language || "en-US",
      );
    }
  }, [data, isLoading]);

  if (isLoading) return <></>;

  if (!data?.user && !data?.workspace) return <></>;

  if (error) {
    return <>an error occurred</>;
  }

  return <>{children}</>;
}
