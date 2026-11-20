import { IconAlignLeft, IconCircleDot, IconLetterT, type TablerIcon } from "@tabler/icons-react";
import type { TemplateVariable } from "@docmost/editor-ext";

export const templateVariableTypes = {
  text: { label: "Single-line text", icon: IconLetterT },
  multiline: { label: "Multi-line text", icon: IconAlignLeft },
  select: { label: "Select", icon: IconCircleDot },
} satisfies Record<TemplateVariable["fieldType"], { label: string; icon: TablerIcon }>;
