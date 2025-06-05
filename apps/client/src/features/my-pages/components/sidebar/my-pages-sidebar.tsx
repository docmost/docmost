import { ActionIcon, Group, Menu, Text, Tooltip } from "@mantine/core";
import {
  IconArrowDown,
  IconDots,
  IconFileExport,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";

import classes from "./my-pages-sidebar.module.css";
import { useAtom } from "jotai";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import clsx from "clsx";
import { useDisclosure } from "@mantine/hooks";
import PageImportModal from "@/features/page/components/page-import-modal.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import MyPagesTree from "@/features/page/tree/components/my-pages-tree/my-pages-tree";

export function MyPagesSidebar() {
  const { t } = useTranslation();
  const [tree] = useAtom(treeApiAtom);

  const [currentUser] = useAtom(currentUserAtom);

  function handleCreatePage() {
    tree?.create({ parentId: null, type: "internal", index: 0 });
  }

  return (
    <>
      <div className={classes.navbar}>
        <div
          className={classes.section}
          style={{
            border: "none",
            marginTop: 2,
            marginBottom: 3,
          }}
        ></div>

        <div className={clsx(classes.section, classes.sectionPages)}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="sm" fw={600} c="dimmed">
              {t("My Pages")}
            </Text>

            <Group gap="xs">
              <Tooltip label={t("Create page")} withArrow position="right">
                <ActionIcon
                  variant="default"
                  size={18}
                  onClick={handleCreatePage}
                  aria-label={t("Create page")}
                >
                  <IconPlus />
                </ActionIcon>
              </Tooltip>

              <MyPagesMenu onSpaceSettings={null} />
            </Group>
          </Group>

          <div className={classes.pages}>
            <MyPagesTree
              spaceId={currentUser.personalSpaceId}
              readOnly={false}
            />
          </div>
        </div>
      </div>
    </>
  );
}

interface MyPagesMenuProps {
  onSpaceSettings: () => void;
}

function MyPagesMenu({ onSpaceSettings }: MyPagesMenuProps) {
  const { t } = useTranslation();
  const [importOpened, { open: openImportModal, close: closeImportModal }] =
    useDisclosure(false);
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);

  const spaceId = "";

  return (
    <>
      <Menu width={200} shadow="md" withArrow>
        <Menu.Target>
          <Tooltip
            label={t("Import pages & space settings")}
            withArrow
            position="top"
          >
            <ActionIcon
              variant="default"
              size={18}
              aria-label={t("Space menu")}
            >
              <IconDots />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            onClick={openImportModal}
            leftSection={<IconArrowDown size={16} />}
          >
            {t("Import pages")}
          </Menu.Item>

          <Menu.Item
            onClick={openExportModal}
            leftSection={<IconFileExport size={16} />}
          >
            {t("Export space")}
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            onClick={onSpaceSettings}
            leftSection={<IconSettings size={16} />}
          >
            {t("Settings")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <PageImportModal
        spaceId={spaceId}
        open={importOpened}
        onClose={closeImportModal}
      />

      <ExportModal
        type="space"
        id={spaceId}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}
