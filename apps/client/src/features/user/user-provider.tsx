import { useAtom } from "jotai";
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
import { Box, Center, Loader, Text } from "@mantine/core";
import APP_ROUTE from "@/lib/app-route.ts";

export function UserProvider({ children }: React.PropsWithChildren) {
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const { data, isLoading, error, isError, refetch } = useCurrentUser();
  const { i18n } = useTranslation();
  const [, setSocket] = useAtom(socketAtom);
  // fetch collab token on load
  const { data: collab } = useCollabToken();

  useEffect(() => {
    if (isLoading || isError) {
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
  }, [isError, isLoading]);

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
  }, [data, isLoading]);

  if (isLoading) {
    return (
      <Center
        h="100vh"
        style={{ background: "var(--mantine-color-gray-0, #f6f7f9)" }}
      >
        <Loader size="lg" color="blue" />
      </Center>
    );
  }

  if (isError && error?.["response"]?.status === 404) {
    return <Error404 />;
  }

  if (error) {
    const status = error?.["response"]?.status;
    const isUnauthorized = status === 401;
    if (isUnauthorized) {
      window.location.href = APP_ROUTE.AUTH.LOGIN;
      return (
        <Center
          h="100vh"
          style={{ background: "var(--mantine-color-gray-0, #f6f7f9)" }}
        >
          <Loader size="lg" color="blue" />
        </Center>
      );
    }
    return (
      <Center
        h="100vh"
        style={{ background: "var(--mantine-color-gray-0, #f6f7f9)" }}
      >
        <Box ta="center">
          <Text c="dimmed" mb="sm">
            加载失败，请检查网络或稍后重试
          </Text>
          <Text
            component="button"
            size="sm"
            variant="link"
            type="button"
            onClick={() => refetch()}
          >
            重试
          </Text>
        </Box>
      </Center>
    );
  }

  return <>{children}</>;
}
