import { Badge, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";

type ScopeBadgesProps = {
  scopes: string[];
};

export function ScopeBadges({ scopes }: ScopeBadgesProps) {
  const { t } = useTranslation();

  const scopeMeta: Record<string, { color: string; label: string }> = {
    read: { color: "blue", label: t("Read") },
    write: { color: "orange", label: t("Write") },
  };

  return (
    <Group gap={4}>
      {scopes.map((scope) => {
        const meta = scopeMeta[scope];
        if (!meta) return null;
        return (
          <Badge key={scope} variant="light" color={meta.color} size="sm">
            {meta.label}
          </Badge>
        );
      })}
    </Group>
  );
}
