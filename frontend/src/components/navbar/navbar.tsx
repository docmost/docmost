import {
  UnstyledButton,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  rem,
} from '@mantine/core';
import { spotlight } from '@mantine/spotlight';
import {
  IconSearch,
  IconPlus,
  IconSettings,
  IconFilePlus,
} from '@tabler/icons-react';

import classes from './navbar.module.css';
import { UserButton } from './user-button';
import React from 'react';
import { useAtom } from 'jotai';
import { settingsModalAtom } from '@/features/settings/modal/atoms/settings-modal-atom';
import SettingsModal from '@/features/settings/modal/settings-modal';
import { SearchSpotlight } from '@/features/search/search-spotlight';
import PageTree from '@/features/page/tree/page-tree';
import { treeApiAtom } from '@/features/page/tree/atoms/tree-api-atom';

interface PrimaryMenuItem {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

const primaryMenu: PrimaryMenuItem[] = [
  { icon: IconSearch, label: 'Search' },
  { icon: IconSettings, label: 'Settings' },
  { icon: IconFilePlus, label: 'New Page' },
];

export function Navbar() {
  const [, setSettingsModalOpen] = useAtom(settingsModalAtom);
  const [tree] = useAtom(treeApiAtom);

  const handleMenuItemClick = (label: string) => {
    if (label === 'Search') {
      spotlight.open();
    }

    if (label === 'Settings') {
      setSettingsModalOpen(true);
    }
  };

  function handleCreatePage() {
    tree?.create({ parentId: null, type: 'internal', index: 0 });
  }

  const primaryMenuItems = primaryMenu.map((menuItem) => (
    <UnstyledButton
      key={menuItem.label}
      className={classes.menu}
      onClick={() => handleMenuItemClick(menuItem.label)}
    >
      <div className={classes.menuItemInner}>
        <menuItem.icon
          size={20}
          className={classes.menuItemIcon}
          stroke={1.5}
        />
        <span>{menuItem.label}</span>
      </div>
    </UnstyledButton>
  ));

  return (
    <>
      <nav className={classes.navbar}>
        <div className={classes.section}>
          <UserButton />
        </div>

        <div className={classes.section}>
          <div className={classes.menuItems}>{primaryMenuItems}</div>
        </div>

        <div className={classes.section}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              Pages
            </Text>

            <Tooltip label="Create page" withArrow position="right">
              <ActionIcon
                variant="default"
                size={18}
                onClick={handleCreatePage}
              >
                <IconPlus
                  style={{ width: rem(12), height: rem(12) }}
                  stroke={1.5}
                />
              </ActionIcon>
            </Tooltip>
          </Group>

          <div className={classes.pages}>
            <PageTree />
          </div>

        </div>
      </nav>

      <SearchSpotlight />
      <SettingsModal />
    </>
  );
}
