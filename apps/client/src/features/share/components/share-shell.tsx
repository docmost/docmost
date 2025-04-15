import React from "react";
import {
  Affix,
  AppShell,
  Burger,
  Button,
  Group,
  ScrollArea,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useGetSharedPageTreeQuery } from "@/features/share/queries/share-query.ts";
import { useParams } from "react-router-dom";
import SharedTree from "@/features/share/components/shared-tree.tsx";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { ThemeToggle } from "@/components/theme-toggle.tsx";
import { useAtomValue } from "jotai";

const MemoizedSharedTree = React.memo(SharedTree);

export default function ShareShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [opened, { toggle }] = useDisclosure();
  const { shareId } = useParams();
  const { data } = useGetSharedPageTreeQuery(shareId);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !opened, desktop: false },
      }}
      aside={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: true, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group wrap="nowrap" justify="space-between" p="sm">
          <Burger opened={opened} onClick={toggle} size="sm" />
          <ThemeToggle />
        </Group>
      </AppShell.Header>

      {data?.pageTree?.length > 0 && (
        <AppShell.Navbar p="md">
          <MemoizedSharedTree sharedPageTree={data} />
        </AppShell.Navbar>
      )}

      <AppShell.Main>
        {children}

        <Affix position={{ bottom: 20, right: 20 }}>
          <Button
            variant="default"
            component="a"
            target="_blank"
            href="https://docmost.com"
          >
            Powered by Docmost
          </Button>
        </Affix>
      </AppShell.Main>

      <AppShell.Aside p="md" withBorder={false}>
        <Text mb="md" fw={500}>
          Table of contents
        </Text>

        <ScrollArea style={{ height: "80vh" }} scrollbarSize={5} type="scroll">
          <div style={{ paddingBottom: "50px" }}>
            {readOnlyEditor && (
              <TableOfContents isShare={true} editor={readOnlyEditor} />
            )}
          </div>
        </ScrollArea>
      </AppShell.Aside>
    </AppShell>
  );
}
