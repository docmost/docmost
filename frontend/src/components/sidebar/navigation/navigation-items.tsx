import React, { ReactNode } from 'react';
import {
  IconHome,
  IconSearch,
  IconSettings,
  IconFilePlus,
} from '@tabler/icons-react';
import NavigationLink from "@/components/sidebar/navigation/navigation-link";
import ButtonWithIcon from "@/components/ui/button-with-icon";

export type NavigationMenuType = {
  label: string;
  path: string;
  icon: ReactNode;
  target?: string,
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
};

export const navigationMenu: NavigationMenuType[] = [
  {
    label: 'Home',
    path: '',
    icon: <IconHome size={16} />,
    target: '/home',
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
    target: '/settings/account'
  },
  {
    label: 'New Page',
    path: '',
    icon: <IconFilePlus size={16} />,
  },
];

export const renderMenuItem = (menu, index) => {
  if (menu.target) {
    return (
      <NavigationLink
        key={index}
        href={menu.target}
        icon={menu.icon}
        className="w-full flex flex-1 justify-start items-center"
      >
        {menu.label}
      </NavigationLink>
    );
  }

  return (
    <ButtonWithIcon
      key={index}
      icon={menu.icon}
      variant="ghost"
      className="w-full flex flex-1 justify-start items-center"
      // onClick={}
    >
      <span className="text-ellipsis overflow-hidden">{menu.label}</span>
    </ButtonWithIcon>
  );
};
