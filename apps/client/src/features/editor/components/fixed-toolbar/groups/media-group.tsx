import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import {
  IconFileTypePdf,
  IconMovie,
  IconMusic,
  IconPaperclip,
  IconPhoto,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action";
import { uploadAudioAction } from "@/features/editor/components/audio/upload-audio-action";
import { uploadAttachmentAction } from "@/features/editor/components/attachment/upload-attachment-action";
import { uploadPdfAction } from "@/features/editor/components/pdf/upload-pdf-action";

import type { UploadTarget } from "@docmost/editor-ext";
import { getEditorUploadTarget } from "@/features/editor/utils/upload-target";

interface Props {
  editor: Editor | null;
}

type UploadFn = (
  file: File,
  editor: Editor,
  pos: number,
  uploadTarget: UploadTarget,
  ...rest: any[]
) => void;

function pickFile(
  editor: Editor,
  accept: string,
  multiple: boolean,
  upload: UploadFn,
  extra?: boolean,
) {
  const uploadTarget = getEditorUploadTarget(editor);
  if (!uploadTarget) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = multiple;
  input.style.display = "none";
  document.body.appendChild(input);
  input.onchange = () => {
    if (input.files?.length && !editor.isDestroyed && editor.isEditable) {
      for (const file of input.files) {
        const pos = editor.view.state.selection.from;
        if (extra !== undefined) {
          upload(file, editor, pos, uploadTarget, extra);
        } else {
          upload(file, editor, pos, uploadTarget);
        }
      }
    }
    input.remove();
  };
  input.click();
}

export const MediaGroup: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();

  const trigger = (
    <Tooltip label={t("Insert media")} withArrow>
      <ActionIcon
        variant="subtle"
        color="dark"
        size="md"
        aria-label={t("Insert media")}
      >
        <IconPhoto size={16} />
      </ActionIcon>
    </Tooltip>
  );
  if (!editor) return trigger;

  return (
    <Menu shadow="md" position="bottom-start" withArrow={false}>
      <Menu.Target>{trigger}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPhoto size={16} />}
          onClick={() => pickFile(editor, "image/*", true, uploadImageAction)}
        >
          {t("Image")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMovie size={16} />}
          onClick={() => pickFile(editor, "video/*", true, uploadVideoAction)}
        >
          {t("Video")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMusic size={16} />}
          onClick={() => pickFile(editor, "audio/*", true, uploadAudioAction)}
        >
          {t("Audio")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileTypePdf size={16} />}
          onClick={() =>
            pickFile(editor, "application/pdf", false, uploadPdfAction)
          }
        >
          PDF
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPaperclip size={16} />}
          onClick={() =>
            pickFile(editor, "", true, uploadAttachmentAction, true)
          }
        >
          {t("File attachment")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
