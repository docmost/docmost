import { Outlet } from "react-router-dom";
import { AppShell } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { 
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import classes from "./app-shell.module.css";
import { useTrialEndAction } from "@/ee/hooks/use-trial-end-action.tsx";
import { SharedSpaceSidebar } from "@/features/space/components/sidebar/shared-space-sidebar";
import { UserAgnosticAppHeader } from "@/components/layouts/global/user-agnostic-app-header";

export default function UserAgnosticLayout() {
  useTrialEndAction();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  const startResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent) => {
      if (isResizing) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < 220) {
          setSidebarWidth(220);
          return;
        }
        if (newWidth > 600) {
          setSidebarWidth(600);
          return;
        }
        setSidebarWidth(newWidth);
      }
    },
    [isResizing],
  );

  useEffect(() => {
    //https://codesandbox.io/p/sandbox/kz9de
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <AppShell
      header={{ height: 45 }}
      navbar={{
          width: sidebarWidth,
          breakpoint: "sm",
          collapsed: {
            mobile: !mobileOpened,
            desktop: !desktopOpened,
          },
        }
      }
      padding="md"
    >
      <AppShell.Header px="md" className={classes.header}>
        <UserAgnosticAppHeader />
      </AppShell.Header>
      <AppShell.Navbar
        className={classes.navbar}
        withBorder={false}
        ref={sidebarRef}
      >
        <div className={classes.resizeHandle} onMouseDown={startResizing} />
        <SharedSpaceSidebar />
      </AppShell.Navbar>
      <AppShell.Main>
          <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
