import { useEffect } from "react";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

export function useDisablePrint(reason: string | null) {
  useHotkeys(
    [
      [
        "mod+P",
        (event) => {
          if (!reason) return;
          event.preventDefault();
          notifications.show({ message: reason, color: "red" });
        },
        { preventDefault: false },
      ],
    ],
    [],
    true,
  );

  useEffect(() => {
    if (!reason) return;
    document.body.dataset.exportDisabled = reason;
    return () => {
      delete document.body.dataset.exportDisabled;
    };
  }, [reason]);
}
