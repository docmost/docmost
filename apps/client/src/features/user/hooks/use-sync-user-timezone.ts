import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateUser } from "@/features/user/services/user-service";
import { ICurrentUser, IUser } from "@/features/user/types/user.types";

export function useSyncUserTimezone(user: IUser | undefined) {
  const queryClient = useQueryClient();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || synced.current) return;
    synced.current = true;

    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserZone || browserZone === user.timezone) return;

    updateUser({ timezone: browserZone })
      .then((updated) => {
        queryClient.setQueryData<ICurrentUser>(["currentUser"], (current) =>
          current
            ? { ...current, user: { ...current.user, timezone: updated.timezone } }
            : current,
        );
      })
      .catch(() => {});
  }, [user]);
}
