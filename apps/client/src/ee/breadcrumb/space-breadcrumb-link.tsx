import { Anchor, Tooltip } from "@mantine/core";
import { Link } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { getSpaceUrl } from "@/lib/config";

interface SpaceBreadcrumbLinkProps {
  spaceSlug: string;
  className?: string;
}

export function SpaceBreadcrumbLink({
  spaceSlug,
  className,
}: SpaceBreadcrumbLinkProps) {
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  if (!space) return null;

  return (
    <Tooltip label={space.name} key="space">
      <Anchor
        component={Link}
        to={getSpaceUrl(space.slug)}
        underline="never"
        fz="sm"
        className={className}
      >
        {space.name}
      </Anchor>
    </Tooltip>
  );
}
