import { useMemo } from "react";
import { Stack, Switch, Text, TextInput, getDefaultZIndex } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import type {
  IBaseProperty,
  RelationCreateTypeOptions,
  RelationTypeOptions,
  RelationUpdateTypeOptions,
} from "@/ee/base/types/base.types";
import { useEditableTypeOptions } from "@/ee/base/hooks/use-editable-type-options";
import { useResolvedPages } from "@/ee/base/queries/base-page-resolver-query";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import { usePageQuery } from "@/features/page/queries/page-query";
import { RELATION_NAME_MAX_LENGTH } from "@/ee/base/constants/relations";
import { OptionsFooter } from "./options-footer";
import { RelationTargetSelect } from "./relation-target-select";

type RelationOptionsProps = {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideButtons?: boolean;
  dropdownPortalTarget?: HTMLElement | null;
};

// creating edits the create input live, editing stages allowMultiple and twoWay behind Save
export function RelationOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
  dropdownPortalTarget,
}: RelationOptionsProps) {
  const { t } = useTranslation();
  const creating = !!hideButtons;
  const stored = property.typeOptions as Partial<RelationTypeOptions>;
  const hadOtherSide = !creating && !!stored.inversePropertyId;
  const initial = useMemo<Record<string, unknown>>(
    () =>
      creating
        ? property.typeOptions
        : { allowMultiple: stored.allowMultiple !== false, twoWay: hadOtherSide },
    [creating, property.typeOptions],
  );
  const { draft, update, isDirty, cancel } = useEditableTypeOptions(initial, {
    onUpdate,
    onClose,
    onDirtyChange,
    hideButtons,
  });
  const options = draft as Partial<RelationCreateTypeOptions>;
  const twoWay = options.twoWay === true;
  const addsOtherSide = twoWay && !hadOtherSide;
  const removesOtherSide = hadOtherSide && !twoWay;

  const targetBaseId = creating ? options.targetBaseId : stored.targetBaseId;
  const { pages } = useResolvedPages([targetBaseId]);
  const related = targetBaseId ? pages.get(targetBaseId) : undefined;
  const relatedTitle = related?.title || t("Untitled");
  const { data: thisBase } = usePageQuery({ pageId: property.pageId });
  const thisBaseTitle = thisBase?.title?.trim() ?? "";
  const { data: relatedBase } = useBaseQuery(targetBaseId);
  const relatedCanEdit = relatedBase?.permissions?.canEdit;
  const otherSideName = relatedBase?.properties.find(
    (p) => p.id === stored.inversePropertyId,
  )?.name;

  const handleSave = () => {
    const changes: RelationUpdateTypeOptions = {};
    if (options.allowMultiple !== initial.allowMultiple) {
      changes.allowMultiple = options.allowMultiple;
    }
    if (twoWay !== hadOtherSide) changes.twoWay = twoWay;
    if (addsOtherSide && options.inverseName) {
      changes.inverseName = options.inverseName;
    }
    const commit = () => {
      onUpdate(changes);
      onClose();
    };
    if (!removesOtherSide) {
      commit();
      return;
    }
    modals.openConfirmModal({
      title: t("Remove from {{base}}", { base: relatedTitle }),
      children: (
        <Text size="sm">
          {otherSideName
            ? t(
                "Are you sure you want to remove this relation from {{base}}? Its {{name}} property will be deleted.",
                { base: relatedTitle, name: otherSideName },
              )
            : t("Are you sure you want to remove this relation from {{base}}?", {
                base: relatedTitle,
              })}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Remove"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: commit,
      // sits above the open property menu without its clicks closing the menu
      zIndex: getDefaultZIndex("popover") + 1,
      onMouseDown: (event) => event.stopPropagation(),
      onTouchStart: (event) => event.stopPropagation(),
    });
  };

  return (
    <Stack gap="xs">
      <RelationTargetSelect
        value={targetBaseId ?? null}
        onChange={(id) => {
          // a newly chosen base starts with Show on off
          if (id !== targetBaseId) {
            update({ targetBaseId: id, twoWay: false, inverseName: undefined });
          }
        }}
        portalTarget={dropdownPortalTarget}
        disabled={!creating}
      />
      <Switch
        size="xs"
        label={t("Allow multiple rows")}
        checked={options.allowMultiple !== false}
        onChange={(e) => update({ allowMultiple: e.currentTarget.checked })}
      />
      {related && (
        <Switch
          size="xs"
          label={t("Show on {{base}}", { base: relatedTitle })}
          aria-label={t("Show on {{base}}", { base: relatedTitle })}
          description={
            relatedCanEdit === false
              ? t("You can't edit {{base}}.", { base: relatedTitle })
              : undefined
          }
          disabled={relatedCanEdit !== true}
          checked={twoWay}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            update({
              twoWay: checked,
              inverseName:
                checked && !hadOtherSide
                  ? thisBaseTitle.slice(0, RELATION_NAME_MAX_LENGTH) || undefined
                  : undefined,
            });
          }}
        />
      )}
      {related && addsOtherSide && (
        <TextInput
          size="xs"
          label={t("Name on {{base}}", { base: relatedTitle })}
          placeholder={thisBaseTitle || t("Untitled")}
          maxLength={RELATION_NAME_MAX_LENGTH}
          value={options.inverseName ?? ""}
          onChange={(e) =>
            update({
              inverseName: e.currentTarget.value.trim()
                ? e.currentTarget.value
                : undefined,
            })
          }
        />
      )}
      {!hideButtons && (
        <OptionsFooter isDirty={isDirty} onCancel={cancel} onSave={handleSave} />
      )}
    </Stack>
  );
}
