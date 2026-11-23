import { Anchor, Breadcrumbs, Text } from "@mantine/core";

export type PickerCrumb = { id: string; name: string };

type Props = {
  crumbs: PickerCrumb[];
  onNavigate: (index: number) => void;
};

export function PickerBreadcrumbs({ crumbs, onNavigate }: Props) {
  if (!crumbs.length) return null;
  return (
    <Breadcrumbs separatorMargin={4}>
      {crumbs.map((crumb, index) =>
        index === crumbs.length - 1 ? (
          <Text key={crumb.id} size="sm" fw={500} truncate>
            {crumb.name}
          </Text>
        ) : (
          <Anchor key={crumb.id} size="sm" onClick={() => onNavigate(index)}>
            {crumb.name}
          </Anchor>
        ),
      )}
    </Breadcrumbs>
  );
}
