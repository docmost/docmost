'use client'

import { ReactNode } from 'react';
import { IconUserCircle, IconUser, IconUsers,
  IconBuilding, IconSettingsCog } from '@tabler/icons-react';

export interface SettingsNavMenuSection {
  heading: string;
  icon: ReactNode;
  items: SettingsNavMenuItem[];
}

export interface SettingsNavMenuItem {
  label: string;
  icon: ReactNode;
  target?: string;
}

export type SettingsNavItem = SettingsNavMenuSection[];

export const settingsNavItems: SettingsNavItem = [
  {
    heading: 'Account',
    icon: <IconUserCircle size={20}/>,
    items: [
      {
        label: 'My account',
        icon: <IconUser size={16}/>,
        target: '/settings/account',
      },
    ],
  },
  {
    heading: 'Workspace',
    icon: <IconBuilding size={20}/>,
    items: [
      {
        label: 'General',
        icon: <IconSettingsCog size={16}/>,
        target: '/settings/workspace',
      },
      {
        label: 'Members',
        icon: <IconUsers size={16}/>,
        target: '/settings/workspace/members',
      },
    ],
  },

];
