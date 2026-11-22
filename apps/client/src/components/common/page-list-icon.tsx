import { ThemeIcon } from "@mantine/core";
import { IconFileDescription, IconTable } from "@tabler/icons-react";

type Props = {
  icon?: string | null;
  isBase?: boolean;
};

export function DefaultPageIcon({ isBase }: Pick<Props, "isBase">) {
  const Icon = isBase ? IconTable : IconFileDescription;
  return <Icon size={18} />;
}

export function PageListIcon({ icon, isBase }: Props) {
  if (icon) {
    return <>{icon}</>;
  }
  return (
    <ThemeIcon variant="transparent" color="gray" size={18}>
      <DefaultPageIcon isBase={isBase} />
    </ThemeIcon>
  );
}
