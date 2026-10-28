import { Anchor, Group, Stack } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import { fileTypeIcon } from "@/features/microsoft/utils/file-type-icon";
import classes from "./microsoft-file.module.css";

export function FileLinkList({ items }: { items: MicrosoftFileItem[] }) {
  return (
    <Stack gap={4} className={classes.linkList}>
      {items.map((item) => (
        <Group key={`${item.driveId}:${item.itemId}`} gap="xs" wrap="nowrap">
          {fileTypeIcon({ name: item.name, size: 18 })}
          <Anchor href={item.webUrl} target="_blank" rel="noopener" size="sm" truncate style={{ flex: 1, minWidth: 0 }}>
            {item.name || item.webUrl}
          </Anchor>
          <IconExternalLink size={14} stroke={1.5} />
        </Group>
      ))}
    </Stack>
  );
}
