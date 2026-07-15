import { useMemo, useState } from "react";
import {
  Button,
  Modal,
  TextInput,
  ScrollArea,
  Loader,
  Text,
  UnstyledButton,
  Group,
  ThemeIcon,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowRight,
  IconSearch,
  IconFileText,
  IconFileSearch,
} from "@tabler/icons-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useGetTemplatesQuery,
  useUseTemplateMutation,
} from "@/ee/template/queries/template-query";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { ITemplate } from "@/ee/template/types/template.types";
import UseTemplateModal from "@/ee/template/components/use-template-modal";
import TemplatePreviewModal from "@/ee/template/components/template-preview-modal";
import { buildPageUrl } from "@/features/page/page.utils";
import classes from "./template-picker-modal.module.css";

type TemplatePickerModalProps = {
  opened: boolean;
  onClose: () => void;
  /** Pre-select this space in the destination picker after a template is chosen. */
  initialSpaceId?: string;
  /** When set alongside initialSpaceId, the created page becomes a child of this page. */
  initialParentPageId?: string;
};

type TemplateSection = {
  key: string;
  label: string;
  items: ITemplate[];
};

export default function TemplatePickerModal({
  opened,
  onClose,
  initialSpaceId,
  initialParentPageId,
}: TemplatePickerModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const useTemplateMutation = useUseTemplateMutation();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 200);
  // Two-stage selection: previewing first, then destination-picker.
  // `previewTemplate` is set when the user clicks a row in the picker.
  // `destinationTemplate` is set when they click "Use template" in the preview.
  const [previewTemplate, setPreviewTemplate] = useState<ITemplate | null>(
    null,
  );
  const [destinationTemplate, setDestinationTemplate] =
    useState<ITemplate | null>(null);

  const { data, isPending } = useGetTemplatesQuery({});
  const { data: spacesData } = useGetSpacesQuery({ limit: 100 });

  const spaceNamesById = useMemo(() => {
    const map = new Map<string, string>();
    spacesData?.items?.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [spacesData]);

  const filtered = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.items) ?? [];
    const term = debouncedQuery.trim().toLowerCase();
    if (!term) return all;
    return all.filter((tpl) => tpl.title.toLowerCase().includes(term));
  }, [data, debouncedQuery]);

  const sections = useMemo<TemplateSection[]>(() => {
    const currentSpace = initialSpaceId
      ? filtered.filter((tpl) => tpl.spaceId === initialSpaceId)
      : [];
    const global = filtered.filter((tpl) => !tpl.spaceId);
    const accountedIds = new Set([...currentSpace, ...global].map((t) => t.id));
    const other = filtered.filter((tpl) => !accountedIds.has(tpl.id));

    return [
      { key: "current", label: t("This space"), items: currentSpace },
      { key: "global", label: t("Global"), items: global },
      { key: "other", label: t("Other spaces"), items: other },
    ].filter((section) => section.items.length > 0);
  }, [filtered, initialSpaceId, t]);

  const isEmpty = sections.length === 0;

  const createInInitialSpace = async (tpl: ITemplate) => {
    if (!initialSpaceId) return;
    try {
      const page = await useTemplateMutation.mutateAsync({
        templateId: tpl.id,
        spaceId: initialSpaceId,
        parentPageId: initialParentPageId,
      });
      setPreviewTemplate(null);
      onClose();
      const space = spacesData?.items?.find((s) => s.id === initialSpaceId);
      if (page?.slugId && space?.slug) {
        navigate(buildPageUrl(space.slug, page.slugId, page.title));
      }
    } catch {
      // error notification handled by mutation's onError
    }
  };

  const handlePick = (tpl: ITemplate) => {
    setPreviewTemplate(tpl);
  };

  const handleQuickUse = (tpl: ITemplate) => {
    if (initialSpaceId) {
      createInInitialSpace(tpl);
      return;
    }
    setDestinationTemplate(tpl);
  };

  const handlePreviewClose = () => {
    // Closing preview returns to the picker list (no full unmount).
    setPreviewTemplate(null);
  };

  const handlePreviewUse = () => {
    if (initialSpaceId && previewTemplate) {
      createInInitialSpace(previewTemplate);
      return;
    }
    // Move from preview into destination-picker stage.
    setDestinationTemplate(previewTemplate);
    setPreviewTemplate(null);
  };

  const handleDestinationClose = () => {
    setDestinationTemplate(null);
    onClose();
  };

  const handleClose = () => {
    setQuery("");
    setPreviewTemplate(null);
    setDestinationTemplate(null);
    onClose();
  };

  const renderRow = (tpl: ITemplate) => (
    <UnstyledButton
      key={tpl.id}
      className={classes.row}
      onClick={() => handlePick(tpl)}
    >
      <ThemeIcon
        className={classes.icon}
        variant="light"
        color="gray"
        size={28}
        radius="md"
      >
        {tpl.icon ? (
          <span className={classes.emoji}>{tpl.icon}</span>
        ) : (
          <IconFileText size={15} />
        )}
      </ThemeIcon>
      <div className={classes.title}>{tpl.title}</div>
      <div className={classes.scope}>
        {tpl.spaceId
          ? spaceNamesById.get(tpl.spaceId) ?? t("Space")
          : t("Global")}
      </div>
      <Button
        size="compact-xs"
        variant="filled"
        className={classes.useButton}
        loading={useTemplateMutation.isPending}
        disabled={useTemplateMutation.isPending}
        onClick={(e) => {
          e.stopPropagation();
          handleQuickUse(tpl);
        }}
      >
        {t("Use")}
      </Button>
    </UnstyledButton>
  );

  return (
    <>
      <Modal
        opened={opened && !previewTemplate && !destinationTemplate}
        onClose={handleClose}
        size={560}
        padding="lg"
        radius="md"
        yOffset="10vh"
        title={<Text fw={600}>{t("Use a template")}</Text>}
      >
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder={t("Search templates...")}
          variant="filled"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          mb="md"
          autoFocus
        />

        <ScrollArea h="50vh" offsetScrollbars>
          {isPending ? (
            <div className={classes.empty}>
              <Loader size="xs" />
            </div>
          ) : isEmpty ? (
            <div className={classes.empty}>
              <ThemeIcon variant="light" color="gray" size={40} radius="xl">
                <IconFileSearch size={20} />
              </ThemeIcon>
              <Text size="sm" c="dimmed" mt="sm">
                {t("No templates found")}
              </Text>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.key} className={classes.section}>
                <Text className={classes.sectionLabel}>{section.label}</Text>
                {section.items.map(renderRow)}
              </div>
            ))
          )}
        </ScrollArea>

        <Group justify="flex-end" mt="md">
          <Button
            component={Link}
            to="/templates"
            variant="subtle"
            size="sm"
            rightSection={<IconArrowRight size={16} />}
            onClick={handleClose}
          >
            {t("Browse all templates")}
          </Button>
        </Group>
      </Modal>

      {previewTemplate && (
        <TemplatePreviewModal
          templateId={previewTemplate.id}
          opened={true}
          onClose={handlePreviewClose}
          onUse={handlePreviewUse}
          useLoading={useTemplateMutation.isPending}
        />
      )}

      {destinationTemplate && (
        <UseTemplateModal
          template={destinationTemplate}
          opened={true}
          onClose={handleDestinationClose}
          initialSpaceId={initialSpaceId}
        />
      )}
    </>
  );
}
