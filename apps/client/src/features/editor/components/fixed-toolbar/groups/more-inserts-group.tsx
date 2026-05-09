import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import {
  IconAppWindow,
  IconCalendar,
  IconCaretRightFilled,
  IconChevronDown,
  IconInfoCircle,
  IconMath,
  IconMathFunction,
  IconRotate2,
  IconSitemap,
  IconTag,
} from "@tabler/icons-react";
import IconExcalidraw from "@/components/icons/icon-excalidraw";
import IconMermaid from "@/components/icons/icon-mermaid";
import IconDrawio from "@/components/icons/icon-drawio";
import {
  AirtableIcon,
  FigmaIcon,
  FramerIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  LoomIcon,
  MiroIcon,
  TypeformIcon,
  VimeoIcon,
  YoutubeIcon,
} from "@/components/icons";
import { useTranslation } from "react-i18next";

interface Props {
  editor: Editor;
}

export const MoreInsertsGroup: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();

  const setEmbed = (provider: string) =>
    editor.chain().focus().setEmbed({ provider }).run();

  const insertDate = () => {
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    editor.chain().focus().insertContent(currentDate).run();
  };

  return (
    <Menu shadow="md" position="bottom-start" withArrow={false} width={240}>
      <Menu.Target>
        <Tooltip label={t("More inserts")} withArrow>
          <ActionIcon
            variant="subtle"
            color="dark"
            size="md"
            aria-label={t("More inserts")}
          >
            <IconChevronDown size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown mah={400} style={{ overflowY: "auto" }}>
        <Menu.Label>{t("Advanced")}</Menu.Label>
        <Menu.Item
          leftSection={<IconInfoCircle size={16} />}
          onClick={() => editor.chain().focus().toggleCallout().run()}
        >
          {t("Callout")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconCaretRightFilled size={16} />}
          onClick={() => editor.chain().focus().setDetails().run()}
        >
          {t("Toggle block")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconTag size={16} />}
          onClick={() =>
            editor.chain().focus().setStatus({ text: "", color: "gray" }).run()
          }
        >
          {t("Status")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconSitemap size={16} />}
          onClick={() => editor.chain().focus().insertSubpages().run()}
        >
          {t("Subpages")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconRotate2 size={16} />}
          onClick={() =>
            editor.chain().focus().insertTransclusionSource().run()
          }
        >
          {t("Synced block")}
        </Menu.Item>

        <Menu.Divider />
        <Menu.Label>{t("Diagrams")}</Menu.Label>
        <Menu.Item
          leftSection={<IconMermaid size={16} />}
          onClick={() =>
            editor
              .chain()
              .focus()
              .setCodeBlock({ language: "mermaid" })
              .insertContent("flowchart LR\n    A --> B")
              .run()
          }
        >
          {t("Mermaid diagram")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconDrawio size={16} />}
          onClick={() => editor.chain().focus().setDrawio().run()}
        >
          Draw.io
        </Menu.Item>
        <Menu.Item
          leftSection={<IconExcalidraw size={16} />}
          onClick={() => editor.chain().focus().setExcalidraw().run()}
        >
          Excalidraw
        </Menu.Item>

        <Menu.Divider />
        <Menu.Label>{t("Embeds")}</Menu.Label>
        <Menu.Item
          leftSection={<IconAppWindow size={16} />}
          onClick={() => setEmbed("iframe")}
        >
          Iframe
        </Menu.Item>
        <Menu.Item
          leftSection={<YoutubeIcon size={16} />}
          onClick={() => setEmbed("youtube")}
        >
          YouTube
        </Menu.Item>
        <Menu.Item
          leftSection={<VimeoIcon size={16} />}
          onClick={() => setEmbed("vimeo")}
        >
          Vimeo
        </Menu.Item>
        <Menu.Item leftSection={<LoomIcon size={16} />} onClick={() => setEmbed("loom")}>
          Loom
        </Menu.Item>
        <Menu.Item
          leftSection={<FigmaIcon size={16} />}
          onClick={() => setEmbed("figma")}
        >
          Figma
        </Menu.Item>
        <Menu.Item
          leftSection={<AirtableIcon size={16} />}
          onClick={() => setEmbed("airtable")}
        >
          Airtable
        </Menu.Item>
        <Menu.Item
          leftSection={<TypeformIcon size={16} />}
          onClick={() => setEmbed("typeform")}
        >
          Typeform
        </Menu.Item>
        <Menu.Item leftSection={<MiroIcon size={16} />} onClick={() => setEmbed("miro")}>
          Miro
        </Menu.Item>
        <Menu.Item
          leftSection={<FramerIcon size={16} />}
          onClick={() => setEmbed("framer")}
        >
          Framer
        </Menu.Item>
        <Menu.Item
          leftSection={<GoogleDriveIcon size={16} />}
          onClick={() => setEmbed("gdrive")}
        >
          Google Drive
        </Menu.Item>
        <Menu.Item
          leftSection={<GoogleSheetsIcon size={16} />}
          onClick={() => setEmbed("gsheets")}
        >
          Google Sheets
        </Menu.Item>

        <Menu.Divider />
        <Menu.Label>{t("Utility")}</Menu.Label>
        <Menu.Item
          leftSection={<IconCalendar size={16} />}
          onClick={insertDate}
        >
          {t("Date")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMathFunction size={16} />}
          onClick={() => editor.chain().focus().setMathInline().run()}
        >
          {t("Math inline")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMath size={16} />}
          onClick={() => editor.chain().focus().setMathBlock().run()}
        >
          {t("Math block")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
