import { useCallback, useMemo, useState } from "react";
import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  FormConfig,
  FormFieldConfig,
  IBase,
  IBaseView,
  UserRef,
} from "@/ee/base/types/base.types";
import { useUpdateFormConfig } from "@/ee/base/queries/base-form-query";
import { FormInlineTextarea } from "@/ee/base/components/form/form-inline-textarea";
import { FormBuilderQuestion } from "@/ee/base/components/form/form-builder-question";
import { FormAddQuestion } from "@/ee/base/components/form/form-add-question";
import { FormSubmitButton } from "@/ee/base/components/form/form-submit-button";
import classes from "@/ee/base/styles/form.module.css";

type FormBuilderProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  pageTitle: string | undefined;
  users: Record<string, UserRef>;
};

export function FormBuilder({
  base,
  view,
  pageId,
  pageTitle,
  users,
}: FormBuilderProps) {
  const { t } = useTranslation();
  const updateForm = useUpdateFormConfig(pageId, view.id);
  const [focusPropertyId, setFocusPropertyId] = useState<string | null>(null);

  const form: FormConfig = view.config?.form ?? {};
  const fields = form.fields ?? [];
  const propertiesById = useMemo(
    () => new Map(base.properties.map((p) => [p.id, p])),
    [base.properties],
  );
  const visibleFields = fields.filter((field) =>
    propertiesById.has(field.propertyId),
  );

  const updateFields = useCallback(
    (recipe: (current: FormFieldConfig[]) => FormFieldConfig[]) =>
      updateForm((current) => {
        const previous = current.fields ?? [];
        const next = recipe(previous);
        return next === previous ? current : { ...current, fields: next };
      }),
    [updateForm],
  );

  const handleAdd = useCallback(
    (propertyIds: string[]) => {
      updateFields((current) => {
        const existing = new Set(current.map((f) => f.propertyId));
        const added = propertyIds
          .filter((id) => !existing.has(id))
          .map((propertyId) => ({ propertyId }));
        return added.length ? [...current, ...added] : current;
      });
      if (propertyIds.length === 1) setFocusPropertyId(propertyIds[0]);
    },
    [updateFields],
  );

  const handleChange = useCallback(
    (propertyId: string, patch: Partial<FormFieldConfig>) =>
      updateFields((current) =>
        current.map((f) =>
          f.propertyId === propertyId ? { ...f, ...patch } : f,
        ),
      ),
    [updateFields],
  );

  const handleRemove = useCallback(
    (propertyId: string) =>
      updateFields((current) =>
        current.filter((f) => f.propertyId !== propertyId),
      ),
    [updateFields],
  );

  const handleMove = useCallback(
    (propertyId: string, offset: -1 | 1) =>
      updateFields((current) => {
        const startIndex = current.findIndex((f) => f.propertyId === propertyId);
        const finishIndex = startIndex + offset;
        if (startIndex === -1 || finishIndex < 0 || finishIndex >= current.length) {
          return current;
        }
        return reorder({ list: current, startIndex, finishIndex });
      }),
    [updateFields],
  );

  const handleReorder = useCallback(
    (activeId: string, targetId: string, edge: Edge) =>
      updateFields((current) => {
        const startIndex = current.findIndex((f) => f.propertyId === activeId);
        const indexOfTarget = current.findIndex((f) => f.propertyId === targetId);
        if (startIndex === -1 || indexOfTarget === -1) return current;
        const finishIndex = getReorderDestinationIndex({
          startIndex,
          indexOfTarget,
          closestEdgeOfTarget: edge,
          axis: "vertical",
        });
        if (finishIndex === startIndex) return current;
        return reorder({ list: current, startIndex, finishIndex });
      }),
    [updateFields],
  );

  const clearFocus = useCallback(() => setFocusPropertyId(null), []);

  const addQuestion = (
    <FormAddQuestion
      base={base}
      fields={fields}
      pageId={pageId}
      onAdd={handleAdd}
    />
  );

  return (
    <div className={classes.builder}>
      <div className={classes.builderHeader}>
        <FormInlineTextarea
          value={form.title ?? ""}
          onCommit={(title) =>
            updateForm((current) => ({ ...current, title: title || undefined }))
          }
          className={classes.inlineTitle}
          ariaLabel={t("Form title")}
          placeholder={pageTitle?.trim() || t("Untitled form")}
          maxLength={300}
          singleLine
        />
        <FormInlineTextarea
          value={form.description ?? ""}
          onCommit={(description) =>
            updateForm((current) => ({
              ...current,
              description: description || undefined,
            }))
          }
          className={classes.inlineDescription}
          ariaLabel={t("Form description")}
          placeholder={t("Add a description")}
          maxLength={5000}
        />
      </div>

      {visibleFields.length === 0 ? (
        <div className={classes.emptyBuilder}>
          <Text fw={600}>{t("Add your first question")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "Each question fills a property of this base, and every response becomes a new row.",
            )}
          </Text>
          {addQuestion}
        </div>
      ) : (
        <div className={classes.builderQuestions}>
          {visibleFields.map((field, index) => (
            <FormBuilderQuestion
              key={field.propertyId}
              field={field}
              property={propertiesById.get(field.propertyId)!}
              pageId={pageId}
              users={users}
              isFirst={index === 0}
              isLast={index === visibleFields.length - 1}
              autoFocus={focusPropertyId === field.propertyId}
              onAutoFocused={clearFocus}
              onChange={(patch) => handleChange(field.propertyId, patch)}
              onRemove={() => handleRemove(field.propertyId)}
              onMove={(offset) => handleMove(field.propertyId, offset)}
              onReorder={handleReorder}
            />
          ))}
        </div>
      )}

      <div className={classes.builderActions}>
        {visibleFields.length > 0 && addQuestion}
        <div inert>
          <FormSubmitButton label={form.submitLabel?.trim() || t("Submit")} />
        </div>
      </div>
    </div>
  );
}
