import { useEffect, useState } from "react";
import { Text, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  formatUserLocalTime,
  getTimezoneCity,
} from "@/features/user/utils/user-time";

type UserLocalTimeProps = {
  timezone: string | null | undefined;
};

export function UserLocalTime({ timezone }: UserLocalTimeProps) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!timezone) return null;

  const time = formatUserLocalTime(timezone, now, i18n.language);
  if (!time) return null;

  return (
    <Tooltip label={timezone.replace(/_/g, " ")} withArrow>
      <Text span fz="sm" c="dimmed">
        {t("{{time}} local time ({{city}})", {
          time,
          city: getTimezoneCity(timezone),
        })}
      </Text>
    </Tooltip>
  );
}
