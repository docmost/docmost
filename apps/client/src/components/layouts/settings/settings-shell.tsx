import { desktopSidebarAtom } from "@/components/navbar/atoms/sidebar-atom.ts";
import { AppShell, Container } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAtom } from "jotai";
import React from "react";
import SettingsSidebar from "@/components/layouts/settings/settings-sidebar.tsx";

export default function SettingsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened] = useAtom(desktopSidebarAtom);

  return (
    <AppShell
      layout="alt"
      header={{ height: 45 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Navbar>
        <SettingsSidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size={800}>{children}</Container>
      </AppShell.Main>
    </AppShell>
  );
}
