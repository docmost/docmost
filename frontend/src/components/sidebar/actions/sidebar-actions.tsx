import { ReactNode } from 'react';
import {
  IconHome,
  IconSearch,
  IconSettings,
  IconFilePlus,
} from '@tabler/icons-react';

export type NavigationMenuType = {
  label: string;
  path: string;
  icon: ReactNode;
  isActive?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
};
export const navigationMenu: NavigationMenuType[] = [
  {
    label: 'Home',
    path: '',
    icon: <IconHome size={16} />,
  },
  {
    label: 'Search',
    path: '',
    icon: <IconSearch size={16} />,
  },
  {
    label: 'Settings',
    path: '',
    icon: <IconSettings size={16} />,
  },
  {
    label: 'New Page',
    path: '',
    icon: <IconFilePlus size={16} />,
  },
];
