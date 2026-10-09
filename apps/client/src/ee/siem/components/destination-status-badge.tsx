import { Badge } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { ISiemDestination } from "@/ee/siem/types/siem.types";

export function DestinationStatusBadge({ destination }: { destination: ISiemDestination }) {
  const { t } = useTranslation();

  if (!destination.enabled) {
    return <Badge color="gray" variant="light">{t("Disabled")}</Badge>;
  }
  if (destination.status === "failing") {
    return <Badge color="red" variant="light">{t("Failing")}</Badge>;
  }
  return <Badge color="green" variant="light">{t("Healthy")}</Badge>;
}
