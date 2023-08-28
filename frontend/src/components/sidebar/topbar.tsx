'use client';

import { ReactNode } from 'react';

import { useIsMobile } from '@/hooks/use-is-mobile';
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from '@/components/sidebar/atoms/sidebar-atom';
import { useToggleSidebar } from './hooks/use-toggle-sidebar';
import ButtonWithIcon from '../ui/button-with-icon';
import { IconLayoutSidebarLeftCollapse } from '@tabler/icons-react';

export default function TopBar() {
  const isMobile = useIsMobile();
  const sidebarStateAtom = isMobile ? mobileSidebarAtom : desktopSidebarAtom;

  const toggleSidebar = useToggleSidebar(sidebarStateAtom);

  return (
    <header className="max-w-full z-50 select-none">
      <div
        className="w-full max-w-full h-[50px] opacity-100 relative
        transition-opacity duration-700 ease-in transition-color duration-700 ease-in"
      >
        <div className="flex justify-between items-center h-full overflow-hidden py-0 px-1 gap-2.5 border-b">
          <div className="flex items-center leading-tight h-full flex-grow-0 mr-[8px] min-w-0 font-semibold text-sm">
            <ButtonWithIcon
              icon={<IconLayoutSidebarLeftCollapse size={20} />}
              variant={'ghost'}
              onClick={toggleSidebar}
            ></ButtonWithIcon>
          </div>
        </div>
      </div>
    </header>
  );
}
