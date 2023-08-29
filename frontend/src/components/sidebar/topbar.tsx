'use client';

import { useIsMobile } from '@/hooks/use-is-mobile';
import SidebarToggleButton from './sidebar-toggle-button';

export default function TopBar() {
  const isMobile = useIsMobile();

  return (
    <header className="max-w-full z-50 select-none">
      <div className="w-full max-w-full h-[50px] opacity-100 relative duration-700 ease-in">
        <div className="flex justify-between items-center h-full overflow-hidden py-0 px-1 gap-2.5 border-b">
          <div className="flex items-center leading-tight h-full flex-grow-0 mr-[8px] min-w-0 font-semibold text-sm">
            {!isMobile && <SidebarToggleButton />}
          </div>
        </div>
      </div>
    </header>
  );
}
