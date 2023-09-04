import React from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from '@/components/sidebar/atoms/sidebar-atom';
import { useToggleSidebar } from './hooks/use-toggle-sidebar';
import ButtonWithIcon from '../ui/button-with-icon';
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import { useAtom } from 'jotai';
import { cn } from '@/lib/utils';

interface SidebarToggleButtonProps {
  className?: string;
}

export default function SidebarToggleButton({
  className,
}: SidebarToggleButtonProps) {
  const isMobile = useIsMobile();
  const sidebarStateAtom = isMobile ? mobileSidebarAtom : desktopSidebarAtom;

  const [isSidebarOpen] = useAtom(sidebarStateAtom);
  const toggleSidebar = useToggleSidebar(sidebarStateAtom);

  const SidebarIcon = isSidebarOpen
    ? IconLayoutSidebarLeftCollapse
    : IconLayoutSidebarRightCollapse;

  return (
    <ButtonWithIcon
      className={cn(className, 'z-50')}
      icon={<SidebarIcon size={20} />}
      variant={'ghost'}
      onClick={toggleSidebar}
    />
  );
}

export function MobileSidebarToggle({ isSidebarOpen }) {
  return (
    <SidebarToggleButton className={`absolute top-0 ${isSidebarOpen ? "right-0" : "left-0"} right-0 m-4`} />
  );
}
