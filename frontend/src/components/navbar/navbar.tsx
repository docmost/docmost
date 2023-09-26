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
import PageTree from '@/features/page/page-tree/page-tree';

interface PrimaryMenuItem {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

interface PageItem {
  emoji: string;
  label: string;
}

const primaryMenu: PrimaryMenuItem[] = [
  { icon: IconSearch, label: 'Search' },
  { icon: IconSettings, label: 'Settings' },
  { icon: IconFilePlus, label: 'New Page' },
];

const pages: PageItem[] = [
  { emoji: '👍', label: 'Sales' },
  { emoji: '🚚', label: 'Deliveries' },
  { emoji: '✨', label: 'Reports' },
];

export function Navbar() {
  const [, setSettingsModalOpen] = useAtom(settingsModalAtom);

  const handleMenuItemClick = (label: string) => {

    if (label === 'Search') {
      spotlight.open();
    }

    if (label === 'Settings') {
      setSettingsModalOpen(true);
    }
  };

  const primaryMenuItems = primaryMenu.map((menuItem) => (
    <UnstyledButton key={menuItem.label} className={classes.menu}
                    onClick={() => handleMenuItemClick(menuItem.label)}
    >
      <div className={classes.menuItemInner}>
        <menuItem.icon size={20} className={classes.menuItemIcon} stroke={1.5} />
        <span>{menuItem.label}</span>
      </div>
    </UnstyledButton>
  ));

  const pageLinks = pages.map((page) => (
    <a
      href="#"
      onClick={(event) => event.preventDefault()}
      key={page.label}
      className={classes.pageLink}
    >
      <span style={{ marginRight: rem(9), fontSize: rem(16) }}>
        {page.emoji}
      </span>{' '}
      {page.label}
    </a>
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
              <ActionIcon variant="default" size={18}>
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


        <div className={classes.section}>
          <Group className={classes.pagesHeader} justify="space-between">
            <Text size="xs" fw={500} c="dimmed">
              Favorites
            </Text>
          </Group>
          <div className={classes.pages}>{pageLinks}</div>
        </div>
      </nav>

      <SearchSpotlight />
      <SettingsModal />
    </>
  );
}
