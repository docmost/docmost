import { ActionIcon, Box, Group, ScrollArea, Text, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import CommentListWithTabs from "@/features/comment/components/comment-list-with-tabs.tsx";
import { useAtom } from "jotai";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import AsideChatPanel from "@/ee/ai-chat/components/aside-chat-panel";
import { PageDetailsAside } from "@/features/page-details/components/page-details-aside.tsx";

export default function Aside() {
  const [{ tab }, setAsideState] = useAtom(asideStateAtom);
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const closeAside = () => setAsideState((s) => ({ ...s, isAsideOpen: false }));

  let title: string;
  let component: ReactNode;

  switch (tab) {
    case "comments":
      component = <CommentListWithTabs />;
      title = "Comments";
      break;
    case "toc":
      component = <TableOfContents editor={pageEditor} />;
      title = "Table of contents";
      break;
    case "chat":
      component = <AsideChatPanel />;
      title = "AI Chat";
      break;
    case "details":
      component = <PageDetailsAside />;
      title = "Details";
      break;
    default:
      component = null;
      title = null;
  }

  return (
    <Box p="md" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {component && (
        <>
          {tab !== "chat" && (
            <Group justify="space-between" wrap="nowrap" mb="md">
              <Text fw={500}>{t(title)}</Text>
              <Tooltip label={t("Close")} withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={closeAside}
                  aria-label={t("Close")}
                >
                  <IconX size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}

          {tab === "comments" || tab === "chat" ? (
            component
          ) : (
            <ScrollArea
              style={{ height: "85vh" }}
              scrollbarSize={5}
              type="scroll"
            >
              <div style={{ paddingBottom: "200px" }}>{component}</div>
            </ScrollArea>
          )}
        </>
      )}
    </Box>
  );
}
