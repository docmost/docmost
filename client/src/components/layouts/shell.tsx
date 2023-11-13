import { desktopAsideAtom, desktopSidebarAtom } from '@/components/navbar/atoms/sidebar-atom';
import { useToggleSidebar } from '@/components/navbar/hooks/use-toggle-sidebar';
import { Navbar } from '@/components/navbar/navbar';
import { AppShell, Burger, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAtom } from 'jotai';
import classes from './shell.module.css';
import Header from '@/components/layouts/header';
import Breadcrumb from '@/components/layouts/components/breadcrumb';
import Aside from '@/components/aside/aside';

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const [desktopAsideOpened] = useAtom(desktopAsideAtom);

  return (
    <AppShell
      layout="alt"
      header={{ height: 45 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      aside={{ width: 300, breakpoint: 'md', collapsed: { mobile: true, desktop: !desktopAsideOpened } }}
      padding="md"
    >
      <AppShell.Header
        className={classes.header}
      >

        <Group justify="space-between" h="100%" px="md" wrap="nowrap">

          <Group h="100%" maw="60%" px="md" wrap="nowrap" style={{ overflow: 'hidden' }}>
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />

            <Breadcrumb />
          </Group>

          <Group justify="flex-end" h="100%" px="md" wrap="nowrap">
            <Header />
          </Group>

        </Group>

      </AppShell.Header>

      <AppShell.Navbar>
        <Navbar />
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>

      <AppShell.Aside className={classes.aside}>
        <Aside />
      </AppShell.Aside>
    </AppShell>
  );
}
