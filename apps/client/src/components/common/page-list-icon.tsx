import { ThemeIcon } from "@mantine/core";
import { IconFileDescription, IconTable } from "@tabler/icons-react";

type Props = {
  icon?: string | null;
  isBase?: boolean;
};

export function PageListIcon({ icon, isBase }: Props) {
  if (icon) {
    return <>{icon}</>;
  }
  return (
    <ThemeIcon variant="transparent" color="gray" size={18}>
      {isBase ? <IconTable size={18} /> : <IconFileDescription size={18} />}
    </ThemeIcon>
  );
}
