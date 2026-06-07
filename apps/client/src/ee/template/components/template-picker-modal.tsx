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
  SegmentedControl,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowRight,
  IconSearch,
  IconFileText,
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
};

type ScopeFilter = "current" | "all";

export default function TemplatePickerModal({
  opened,
  onClose,
  initialSpaceId,
}: TemplatePickerModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const useTemplateMutation = useUseTemplateMutation();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 200);
  const [scope, setScope] = useState<ScopeFilter>(
    initialSpaceId ? "current" : "all",
  );
  // Two-stage selection: previewing first, then destination-picker.
  // `previewTemplate` is set when the user clicks a row in the picker.
  // `destinationTemplate` is set when they click "Use template" in the preview.
  const [previewTemplate, setPreviewTemplate] = useState<ITemplate | null>(
    null,
  );
  const [destinationTemplate, setDestinationTemplate] =
    useState<ITemplate | null>(null);

  const { data, isPending } = useGetTemplatesQuery({
    spaceId: scope === "current" ? initialSpaceId : undefined,
  });
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

  const createInInitialSpace = async (tpl: ITemplate) => {
    if (!initialSpaceId) return;
    try {
      const page = await useTemplateMutation.mutateAsync({
        templateId: tpl.id,
        spaceId: initialSpaceId,
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
    setScope(initialSpaceId ? "current" : "all");
    setPreviewTemplate(null);
    setDestinationTemplate(null);
    onClose();
  };

  return (
    <>
      <Modal
        opened={opened && !previewTemplate && !destinationTemplate}
        onClose={handleClose}
        size={550}
        padding="lg"
        yOffset="10vh"
        title={<Text fw={500}>{t("Use a template")}</Text>}
      >
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder={t("Search templates...")}
          variant="filled"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          mb="xs"
          autoFocus
        />

        {initialSpaceId && (
          <SegmentedControl
            fullWidth
            size="xs"
            mb="sm"
            value={scope}
            onChange={(v) => setScope(v as ScopeFilter)}
            data={[
              { label: t("This space"), value: "current" },
              { label: t("All templates"), value: "all" },
            ]}
          />
        )}

        <ScrollArea h="50vh" offsetScrollbars>
          {isPending ? (
            <div className={classes.empty}>
              <Loader size="xs" />
            </div>
          ) : filtered.length === 0 ? (
            <div className={classes.empty}>
              <Text size="sm" c="dimmed">
                {t("No templates found")}
              </Text>
            </div>
          ) : (
            filtered.map((tpl) => (
              <UnstyledButton
                key={tpl.id}
                className={classes.row}
                onClick={() => handlePick(tpl)}
              >
                <div className={classes.icon}>
                  {tpl.icon ? (
                    <span>{tpl.icon}</span>
                  ) : (
                    <IconFileText
                      size={16}
                      color="var(--mantine-color-gray-6)"
                    />
                  )}
                </div>
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
