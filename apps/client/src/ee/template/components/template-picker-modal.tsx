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
import {
  useGetSpacesQuery,
  useUnlistedSpaceQuery,
} from "@/features/space/queries/space-query";
import { includeSpace } from "@/features/space/space.utils";
import { ITemplate, type TemplateVariableValues } from "@/ee/template/types/template.types";
import { useTemplateVariables } from "./template-variables-form";
import UseTemplateModal from "@/ee/template/components/use-template-modal";
import TemplatePreviewModal from "@/ee/template/components/template-preview-modal";
import { buildPageUrl } from "@/features/page/page.utils";
import classes from "./template-picker-modal.module.css";

type TemplatePickerModalProps = {
  opened: boolean;
  onClose: () => void;
  /** Pre-select this space in the destination picker after a template is chosen. */
  initialSpaceId?: string;
  /** Receives the chosen template instead of creating a page from it. */
  onUse?: (template: ITemplate, values?: TemplateVariableValues) => Promise<boolean>;
};

type ScopeFilter = "current" | "all";

export default function TemplatePickerModal({
  opened,
  onClose,
  initialSpaceId,
  onUse,
}: TemplatePickerModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const useTemplateMutation = useUseTemplateMutation();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, 200);
  const [scope, setScope] = useState<ScopeFilter>(
    initialSpaceId ? "current" : "all",
  );
  const [previewTemplate, setPreviewTemplate] = useState<ITemplate | null>(
    null,
  );
  const [destinationTemplate, setDestinationTemplate] =
    useState<{ template: ITemplate; values?: TemplateVariableValues } | null>(null);

  const { data, isPending } = useGetTemplatesQuery({
    spaceId: scope === "current" ? initialSpaceId : undefined,
    currentSpaceId: scope === "all" ? initialSpaceId : undefined,
  });
  const { data: spacesData } = useGetSpacesQuery({ limit: 100 });
  const { data: initialSpace } = useUnlistedSpaceQuery(
    initialSpaceId,
    spacesData?.items,
  );

  const spaces = useMemo(
    () => includeSpace(spacesData?.items ?? [], initialSpace),
    [spacesData, initialSpace],
  );

  const spaceNamesById = useMemo(() => {
    const map = new Map<string, string>();
    spaces.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [spaces]);

  const filtered = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.items) ?? [];
    const term = debouncedQuery.trim().toLowerCase();
    if (!term) return all;
    return all.filter((tpl) => tpl.title.toLowerCase().includes(term));
  }, [data, debouncedQuery]);

  const variables = useTemplateVariables(async (tpl, variableValues) => {
    if (onUse) {
      const applied = await onUse(tpl, variableValues);
      if (applied) handleClose();
      return applied;
    }
    if (!initialSpaceId) {
      setDestinationTemplate({ template: tpl, values: variableValues });
      setPreviewTemplate(null);
      return;
    }
    try {
      const page = await useTemplateMutation.mutateAsync({
        template: tpl,
        spaceId: initialSpaceId,
        variableValues,
      });
      setPreviewTemplate(null);
      onClose();
      const space = spaces.find((s) => s.id === initialSpaceId);
      if (page?.slugId && space?.slug) {
        navigate(buildPageUrl(space.slug, page.slugId, page.title));
      }
    } catch {
      return false;
    }
  }, onUse ? t("Apply template") : initialSpaceId ? t("Create page") : t("Continue"));

  const handlePick = (tpl: ITemplate) => {
    variables.cancel();
    setPreviewTemplate(tpl);
  };

  const handlePreviewClose = () => {
    variables.cancel();
    setPreviewTemplate(null);
  };

  const handleDestinationClose = () => {
    setDestinationTemplate(null);
    onClose();
  };

  const handleClose = () => {
    variables.cancel();
    setQuery("");
    setScope(initialSpaceId ? "current" : "all");
    setPreviewTemplate(null);
    setDestinationTemplate(null);
    onClose();
  };

  return (
    <>
      <Modal
        opened={opened && !previewTemplate && !destinationTemplate && !variables.form}
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
              <div key={tpl.id} className={classes.row}>
                <UnstyledButton
                  className={classes.pickButton}
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
                </UnstyledButton>
                <Button
                  size="compact-xs"
                  variant="filled"
                  className={classes.useButton}
                  disabled={!!variables.loadingId}
                  loading={variables.loadingId === tpl.id}
                  onClick={() => variables.choose(tpl)}
                >
                  {t("Use")}
                </Button>
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

      {variables.form}
      {previewTemplate && (
        <TemplatePreviewModal
          templateId={previewTemplate.id}
          opened={!variables.form}
          onClose={handlePreviewClose}
          onUse={() => variables.choose(previewTemplate)}
          useLoading={!!variables.loadingId}
        />
      )}

      {destinationTemplate && (
        <UseTemplateModal
          template={destinationTemplate.template}
          variableValues={destinationTemplate.values}
          opened={true}
          onClose={handleDestinationClose}
          initialSpaceId={initialSpaceId}
        />
      )}
    </>
  );
}
