import { Modal, Text, ScrollArea, Button, Group, Center, Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useGetTemplateByIdQuery } from "@/ee/template/queries/template-query";
import ReadonlyTemplateEditor from "@/ee/template/components/readonly-template-editor";

type TemplatePreviewModalProps = {
  templateId: string;
  opened: boolean;
  onClose: () => void;
  onUse: () => void;
  onEdit?: () => void;
};

export default function TemplatePreviewModal({
  templateId,
  opened,
  onClose,
  onUse,
  onEdit,
}: TemplatePreviewModalProps) {
  const { t } = useTranslation();
  const { data: template, isLoading } = useGetTemplateByIdQuery(templateId);

  const title = template?.title || t("Untitled");

  return (
    <Modal.Root size={1200} opened={opened} onClose={onClose}>
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header>
          <Modal.Title>
            <Group gap="xs">
              {template?.icon && <Text size="lg">{template.icon}</Text>}
              <Text size="md" fw={500}>
                {title}
              </Text>
            </Group>
          </Modal.Title>
          <Group gap="sm">
            {onEdit && (
              <Button size="xs" variant="default" onClick={onEdit}>
                {t("Edit")}
              </Button>
            )}
            <Button size="xs" onClick={onUse}>
              {t("Use template")}
            </Button>
            <Modal.CloseButton />
          </Group>
        </Modal.Header>
        <Modal.Body p={0}>
          {isLoading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : (
            <ScrollArea h="80vh" w="100%" scrollbarSize={5}>
              {template && <ReadonlyTemplateEditor template={template} />}
            </ScrollArea>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
