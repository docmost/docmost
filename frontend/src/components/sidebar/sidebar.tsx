import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAtom } from "jotai";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/sidebar/atoms/sidebar-atom";
import { MobileSidebarToggle } from "./sidebar-toggle-button";
import SettingsNav from "@/features/settings/nav/settings-nav";
import { usePathname } from "next/navigation";
import React, { useEffect } from "react";
import Navigation from "@/components/sidebar/navigation/navigation";

export default function Sidebar() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(isMobile ? mobileSidebarAtom : desktopSidebarAtom);
  const isSettings = pathname.startsWith("/settings");

  const mobileClass = "fixed top-0 left-0 h-screen z-50 bg-background";
  const sidebarWidth = isSidebarOpen ? "w-[270px]" : "w-[0px]";

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [pathname, isMobile, setIsSidebarOpen]);

  return (
    <>
      {isMobile && isSidebarOpen && (
        <div className="fixed top-0 left-0 w-full h-screen z-[50] bg-black/60"
             onClick={closeSidebar}>
        </div>
      )}

      <nav
        className={`${sidebarWidth} ${isMobile && isSidebarOpen ? mobileClass : ""} 
        flex-grow-0 flex-shrink-0 overflow-hidden border-r duration-300 z-49`}>

        {isMobile && (
          <MobileSidebarToggle isSidebarOpen={isSidebarOpen} />
        )}

        <div className="flex flex-col flex-shrink-0 gap-0.5 p-[10px]">
          <div className="h-full mt-[8px]">
            {isSettings ? <SettingsNav /> : <Navigation />}
          </div>
        </div>
      </nav>
    </>
  );
}
