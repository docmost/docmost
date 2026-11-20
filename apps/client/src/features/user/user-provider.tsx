import { useAtom, useSetAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import React, { useEffect } from "react";
import useCurrentUser from "@/features/user/hooks/use-current-user";
import { useTranslation } from "react-i18next";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/features/websocket/types";
import { useQuerySubscription } from "@/features/websocket/use-query-subscription.ts";
import { useTreeSocket } from "@/features/websocket/use-tree-socket.ts";
import { useNotificationSocket } from "@/features/notification/hooks/use-notification-socket.ts";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useEntitlements } from "@/ee/entitlement/use-entitlements";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { useSyncUserTimezone } from "@/features/user/hooks/use-sync-user-timezone";

export function UserProvider({
  children, pending,
}: React.PropsWithChildren<{ pending: React.ReactNode }>) {
  const [lastSession, setCurrentUser] = useAtom(currentUserAtom);
  const setEntitlements = useSetAtom(entitlementAtom);
  const { data, isPending, error, isError, refetch } = useCurrentUser();
  const { data: entitlements } = useEntitlements();
  const { i18n, t } = useTranslation();
  const [, setSocket] = useAtom(socketAtom);
  // fetch collab token on load
  useCollabToken(data?.user ?? lastSession?.user);

  useEffect(() => {
    if (!data?.user) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "currentUser" || event.storageArea !== localStorage) return;
      if (!event.newValue) {
        window.location.replace("/login");
        return;
      }
      try {
        const next = JSON.parse(event.newValue)?.user;
        if (next?.id !== data.user.id || next?.workspaceId !== data.user.workspaceId) {
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [data?.user?.id, data?.user?.workspaceId]);

  useEffect(() => {
    if (isPending || isError) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });

    // @ts-ignore
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("ws connected");
    });

    return () => {
      console.log("ws disconnected");
      newSocket.disconnect();
    };
  }, [isError, isPending]);

  useSyncUserTimezone(data?.user);
  useQuerySubscription();
  useTreeSocket();
  useNotificationSocket();

  useEffect(() => {
    if (data && data.user && data.workspace) {
      setCurrentUser(data);
      i18n.changeLanguage(
        data.user.locale === "en" ? "en-US" : data.user.locale,
      );
    }
  }, [data, isPending]);

  useEffect(() => {
    if (entitlements) {
      setEntitlements(entitlements);
    }
  }, [entitlements]);

  if (isPending) return pending;

  if (isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  if (error) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title={t("Something went wrong")}
        action={
          <Button variant="default" onClick={() => refetch()}>
            {t("Try again")}
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
