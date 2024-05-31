import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import { Group } from "@mantine/core";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";

export default function PageHeader() {
  return (
    <div className={classes.header}>
      <Group justify="space-between" h="100%" px="md" wrap="nowrap">
        <Breadcrumb />

        <Group justify="flex-end" h="100%" px="md" wrap="nowrap">
          <PageHeaderMenu />
        </Group>
      </Group>
    </div>
  );
}
