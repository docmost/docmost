import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import { Group } from "@mantine/core";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";

interface Props {
  readOnly?: boolean;
  isHome?: boolean
  spaceId?:string
  pageId: string
}
export default function PageHeader({ readOnly, isHome, spaceId, pageId }: Props) {
  return (
    <div className={classes.header}>
      <Group justify="space-between" h="100%" px="md" wrap="nowrap" className={classes.group}>
        <Breadcrumb />

        <Group justify="flex-end" h="100%" px="md" wrap="nowrap" gap="var(--mantine-spacing-xs)">
          <PageHeaderMenu 
          readOnly={readOnly} 
          isHome={isHome}
          spaceId={spaceId}
          pageId={pageId}
          />
        </Group>
      </Group>
    </div>
  );
}
