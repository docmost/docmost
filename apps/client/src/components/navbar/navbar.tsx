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
  IconHome,
} from '@tabler/icons-react';

import classes from './navbar.module.css';
import { UserButton } from './user-button';
import React from 'react';
import { useAtom } from 'jotai';
import { SearchSpotlight } from '@/features/search/search-spotlight';
import { treeApiAtom } from '@/features/page/tree/atoms/tree-api-atom';
import PageTree from '@/features/page/tree/page-tree';
import { useNavigate } from 'react-router-dom';

interface PrimaryMenuItem {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

const primaryMenu: PrimaryMenuItem[] = [
  { icon: IconHome, label: 'Home' },
  { icon: IconSearch, label: 'Search' },
  { icon: IconSettings, label: 'Settings' },
  // { icon: IconFilePlus, label: 'New Page' },
];

export function Navbar() {
  const [tree] = useAtom(treeApiAtom);
  const navigate = useNavigate();

  const handleMenuItemClick = (label: string) => {
    if (label === 'Home') {
      navigate('/home');
    }

    if (label === 'Search') {
      spotlight.open();
    }

    if (label === 'Settings') {
      navigate('/settings/workspace');
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
        <menuItem.icon size={18} className={classes.menuItemIcon} stroke={2} />
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
    </>
  );
}
