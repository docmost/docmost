import { useState } from "react";
import {
  Container,
  Title,
  Group,
  Button,
  SimpleGrid,
  Select,
  Text,
  Center,
  Skeleton,
  Card,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDisclosure } from "@mantine/hooks";
import { getAppName } from "@/lib/config";
import {
  useGetTemplatesQuery,
  useDeleteTemplateMutation,
} from "@/ee/template/queries/template-query";
import TemplateCard from "@/ee/template/components/template-card";
import { ITemplate } from "@/ee/template/types/template.types";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import UseTemplateModal from "@/ee/template/components/use-template-modal";
import TemplatePreviewModal from "@/ee/template/components/template-preview-modal";
import useUserRole from "@/hooks/use-user-role";
import CreateTemplateModal from "@/ee/template/components/create-template-modal";

export default function TemplateList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin: isWorkspaceAdmin } = useUserRole();
  const [spaceFilter, setSpaceFilter] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ITemplate | null>(
    null,
  );
  const [useModalOpened, { open: openUseModal, close: closeUseModal }] =
    useDisclosure(false);
  const [previewOpened, { open: openPreview, close: closePreview }] =
    useDisclosure(false);
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] =
    useDisclosure(false);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetTemplatesQuery({
    spaceId: spaceFilter || undefined,
  });

  const templates = data?.pages.flatMap((p) => p.items) ?? [];

  const { data: spaces } = useGetSpacesQuery({ limit: 100 });
  const deleteTemplateMutation = useDeleteTemplateMutation();

  const spaceOptions = [
    { value: "", label: t("All templates") },
    ...(spaces?.items?.map((s) => ({ value: s.id, label: s.name })) || []),
  ];

  const spaceNameMap = new Map(
    spaces?.items?.map((s) => [s.id, s.name]) || [],
  );

  const handlePreview = (template: ITemplate) => {
    setSelectedTemplate(template);
    openPreview();
  };

  const handleUse = (template: ITemplate) => {
    setSelectedTemplate(template);
    closePreview();
    openUseModal();
  };

  const handleEdit = (template: ITemplate) => {
    navigate(`/templates/${template.id}`);
  };

  const handleDelete = (template: ITemplate) => {
    modals.openConfirmModal({
      title: t("Are you sure you want to delete this template?"),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteTemplateMutation.mutate(template.id),
    });
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Templates")} - {getAppName()}
        </title>
      </Helmet>

      <Container size="900" pt="xl">
        <Group justify="space-between" mb="xl">
          <Title order={3}>{t("Templates")}</Title>
          {isWorkspaceAdmin && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={openCreateModal}
            >
              {t("New template")}
            </Button>
          )}
        </Group>

        <Group mb="lg">
          <Select
            data={spaceOptions}
            value={spaceFilter || ""}
            onChange={(val) => setSpaceFilter(val || null)}
            placeholder={t("Filter by space")}
            clearable={false}
            searchable
            size="sm"
            w={220}
            comboboxProps={{ width: "target" }}
          />
        </Group>

        {isLoading ? (
          <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} radius="md" padding="lg" style={{ boxShadow: "rgba(0, 0, 0, 0.07) 0px 2px 45px 4px" }}>
                <Group justify="space-between" align="flex-start" mb="md">
                  <Skeleton width={36} height={36} radius="md" />
                </Group>
                <Skeleton height={14} width="70%" mb={8} />
                <Skeleton height={10} width="50%" mb="sm" />
                <Group justify="space-between" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-2)", marginTop: "auto" }}>
                  <Skeleton height={20} width={60} radius="xl" />
                  <Group gap={6}>
                    <Skeleton height={18} circle />
                    <Skeleton height={10} width={80} />
                  </Group>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        ) : templates.length ? (
          <>
            <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  spaceName={
                    template.spaceId
                      ? spaceNameMap.get(template.spaceId)
                      : undefined
                  }
                  onUse={handlePreview}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  canManage={isWorkspaceAdmin}
                />
              ))}
            </SimpleGrid>
            {hasNextPage && (
              <Button
                variant="subtle"
                fullWidth
                mt="sm"
                mb="xl"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t("Load more")}
              </Button>
            )}
          </>
        ) : (
          <Center py="xl">
            <Text c="dimmed">{t("No templates found")}</Text>
          </Center>
        )}
      </Container>

      <CreateTemplateModal
        opened={createModalOpened}
        onClose={closeCreateModal}
      />

      {selectedTemplate && (
        <>
          <TemplatePreviewModal
            templateId={selectedTemplate.id}
            opened={previewOpened}
            onClose={closePreview}
            onUse={() => handleUse(selectedTemplate)}
            onEdit={isWorkspaceAdmin ? () => handleEdit(selectedTemplate) : undefined}
          />
          <UseTemplateModal
            template={selectedTemplate}
            opened={useModalOpened}
            onClose={closeUseModal}
          />
        </>
      )}
    </>
  );
}
