import { Card, Text, ActionIcon, Menu, Group } from "@mantine/core";
import {
  IconDots,
  IconEdit,
  IconTrash,
  IconFileText,
} from "@tabler/icons-react";
import { ITemplate } from "@/ee/template/types/template.types";
import { useTranslation } from "react-i18next";
import classes from "./template-card.module.css";

type TemplateCardProps = {
  template: ITemplate;
  spaceName?: string;
  onUse: (template: ITemplate) => void;
  onEdit?: (template: ITemplate) => void;
  onDelete?: (template: ITemplate) => void;
  canManage?: boolean;
};

export default function TemplateCard({
  template,
  spaceName,
  onUse,
  onEdit,
  onDelete,
  canManage,
}: TemplateCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      radius="md"
      padding="lg"
      className={classes.card}
      style={{ cursor: "pointer" }}
      onClick={() => onUse(template)}
    >
      <div className={classes.cardBody}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
          {template.icon ? (
            <div className={classes.icon}>{template.icon}</div>
          ) : (
            <div className={classes.iconFallback}>
              <IconFileText size={20} stroke={1.5} />
            </div>
          )}

          <Group gap={6} wrap="nowrap">
            {canManage && (
              <Menu width={150} shadow="md" withArrow>
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    color="gray"
                    className={classes.menuTarget}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconEdit size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(template);
                    }}
                  >
                    {t("Edit")}
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(template);
                    }}
                  >
                    {t("Delete")}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>

        <div className={classes.title}>{template.title}</div>

        <div className={classes.footer}>
          <Text size="sm" fw={500} c="dimmed">
            {template.spaceId ? (spaceName || t("Space")) : t("Global")}
          </Text>
        </div>
      </div>
    </Card>
  );
}
