import { timeAgo } from "@/lib/time.ts";
import { useEffect, useState } from "react";

export function useTimeAgo(date: Date | string) {
  const [value, setValue] = useState(() => timeAgo(new Date(date)));

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(timeAgo(new Date(date)));
    }, 5 * 1000);

    return () => clearInterval(interval);
  }, [date]);

  return value;
}
