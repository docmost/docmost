'use client';

import React, { useState } from 'react';
import classes from '@/features/settings/modal/modal.module.css';
import { IconBell, IconFingerprint, IconReceipt, IconSettingsCog, IconUser, IconUsers } from '@tabler/icons-react';
import { Loader, ScrollArea, Text } from '@mantine/core';

const AccountSettings = React.lazy(() => import('@/features/settings/account/settings/account-settings'));
const WorkspaceSettings = React.lazy(() => import('@/features/settings/workspace/settings/workspace-settings'));
const WorkspaceMembers = React.lazy(() => import('@/features/settings/workspace/members/workspace-members'));

interface DataItem {
  label: string;
  icon: React.ElementType;
}

interface DataGroup {
  heading: string;
  items: DataItem[];
}

const groupedData: DataGroup[] = [
  {
    heading: 'Account',
    items: [
      { label: 'Account', icon: IconUser },
      { label: 'Notifications', icon: IconBell },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { label: 'General', icon: IconSettingsCog },
      { label: 'Members', icon: IconUsers },
      { label: 'Security', icon: IconFingerprint },
      { label: 'Billing', icon: IconReceipt },
    ],
  },
];

export default function SettingsSidebar() {
  const [active, setActive] = useState('Account');

  const menu = groupedData.map((group) => (
    <div key={group.heading}>
      <Text c="dimmed" className={classes.sidebarItemHeader}>{group.heading}</Text>
      {group.items.map((item) => (
        <div
          className={classes.sidebarItem}
          data-active={item.label === active || undefined}
          key={item.label}
          onClick={(event) => {
            event.preventDefault();
            setActive(item.label);
          }}
        >
          <item.icon className={classes.sidebarItemIcon} stroke={1.5} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  ));

  let ActiveComponent;

  switch (active) {
    case 'Account':
      ActiveComponent = AccountSettings;
      break;
    case 'General':
      ActiveComponent = WorkspaceSettings;
      break;
    case 'Members':
      ActiveComponent = WorkspaceMembers;
      break;
    default:
      ActiveComponent = null;
  }

  return (
    <div className={classes.sidebarFlex}>
      <nav className={classes.sidebar}>
        <div className={classes.sidebarMain}>
          {menu}
        </div>
      </nav>


      <ScrollArea h="650" w="100%" scrollbarSize={4}>

        <div className={classes.sidebarRightSection}>

          <React.Suspense fallback={<Loader size="sm" color="gray" />}>
            {ActiveComponent && <ActiveComponent />}
          </React.Suspense>

        </div>
      </ScrollArea>


    </div>
  );
}
