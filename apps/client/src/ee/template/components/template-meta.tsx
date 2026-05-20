import { Group, Text } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { useTranslation } from "react-i18next";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { ITemplate } from "@/ee/template/types/template.types";

type TemplateMetaProps = {
  template: ITemplate;
};

export default function TemplateMeta({ template }: TemplateMetaProps) {
  const { t } = useTranslation();
  const updatedAtAgo = useTimeAgo(template.updatedAt);

  return (
    <Group gap={8} mt="xs" wrap="nowrap" style={{ cursor: "default" }}>
      {template.creator?.name && (
        <>
          <CustomAvatar
            size={24}
            radius="xl"
            name={template.creator.name}
            avatarUrl={template.creator.avatarUrl}
          />
          <Text size="sm" c="dimmed" fw={500}>
            {t("By {{name}}", { name: template.creator.name })}
          </Text>
        </>
      )}
      {updatedAtAgo && (
        <Text size="sm" c="dimmed">
          {t("Updated {{time}}", { time: updatedAtAgo })}
        </Text>
      )}
    </Group>
  );
}
