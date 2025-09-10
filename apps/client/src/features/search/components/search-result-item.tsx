import React from "react";
import {
  Group,
  Center,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  getDefaultZIndex,
} from "@mantine/core";
import { Spotlight } from "@mantine/spotlight";
import { Link } from "react-router-dom";
import { IconFile, IconDownload } from "@tabler/icons-react";
import { buildPageUrl } from "@/features/page/page.utils";
import { getPageIcon } from "@/lib";
import {
  IAttachmentSearch,
  IPageSearch,
} from "@/features/search/types/search.types";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";

interface SearchResultItemProps {
  result: IPageSearch | IAttachmentSearch;
  isAttachmentResult: boolean;
  showSpace?: boolean;
}

export function SearchResultItem({
  result,
  isAttachmentResult,
  showSpace,
}: SearchResultItemProps) {
  const { t } = useTranslation();

  if (isAttachmentResult) {
    const attachmentResult = result as IAttachmentSearch;

    const handleDownload = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const downloadUrl = `/api/files/${attachmentResult.id}/${attachmentResult.fileName}`;
      window.open(downloadUrl, "_blank");
    };

    return (
      <Spotlight.Action
        component={Link}
        //@ts-ignore
        to={buildPageUrl(
          attachmentResult.space.slug,
          attachmentResult.page.slugId,
          attachmentResult.page.title,
        )}
        style={{ userSelect: "none" }}
      >
        <Group wrap="nowrap" w="100%">
          <Center>
            <IconFile size={16} />
          </Center>

          <div style={{ flex: 1 }}>
            <Text>{attachmentResult.fileName}</Text>
            <Text size="xs" opacity={0.6}>
              {attachmentResult.space.name} • {attachmentResult.page.title}
            </Text>

            {attachmentResult?.highlight && (
              <Text
                opacity={0.6}
                size="xs"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(attachmentResult.highlight, {
                    ALLOWED_TAGS: ["mark", "em", "strong", "b"],
                    ALLOWED_ATTR: [],
                  }),
                }}
              />
            )}
          </div>

          <Tooltip
            label={t("Download attachment")}
            zIndex={getDefaultZIndex("max")}
            withArrow
          >
            <ActionIcon variant="subtle" color="gray" onClick={handleDownload}>
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Spotlight.Action>
    );
  } else {
    const pageResult = result as IPageSearch;
    return (
      <Spotlight.Action
        component={Link}
        //@ts-ignore
        to={buildPageUrl(
          pageResult.space.slug,
          pageResult.slugId,
          pageResult.title,
        )}
        style={{ userSelect: "none" }}
      >
        <Group wrap="nowrap" w="100%">
          <Center>{getPageIcon(pageResult?.icon)}</Center>

          <div style={{ flex: 1 }}>
            <Text>{pageResult.title}</Text>

            {showSpace && pageResult.space && (
              <Badge variant="light" size="xs" color="gray">
                {pageResult.space.name}
              </Badge>
            )}

            {pageResult?.highlight && (
              <Text
                opacity={0.6}
                size="xs"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(pageResult.highlight, {
                    ALLOWED_TAGS: ["mark", "em", "strong", "b"],
                    ALLOWED_ATTR: [],
                  }),
                }}
              />
            )}
          </div>
        </Group>
      </Spotlight.Action>
    );
  }
}
