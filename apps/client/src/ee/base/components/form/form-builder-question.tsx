import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Menu,
  Popover,
  Switch,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconUsers,
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconDots,
  IconGripVertical,
  IconTextPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {
  FormFieldConfig,
  IBaseProperty,
  UserRef,
} from "@/ee/base/types/base.types";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { PropertyMenuContent } from "@/ee/base/components/property/property-menu";
import { BaseDropEdgeIndicator } from "@/ee/base/components/grid/base-drop-edge-indicator";
import {
  propertyMenuCloseRequestAtomFamily,
  propertyMenuDirtyAtomFamily,
} from "@/ee/base/atoms/base-atoms";
import { FormInlineTextarea } from "@/ee/base/components/form/form-inline-textarea";
import { FormFieldControl } from "@/ee/base/components/form/form-field-control";
import { FormRequiredMark } from "@/ee/base/components/form/form-required-mark";
import {
  initialAnswer,
  isFormFieldProperty,
  isMemberOnlyField,
  toFormField,
} from "@/ee/base/components/form/form-definition";
import classes from "@/ee/base/styles/form.module.css";

const FORM_QUESTION_DRAG_TYPE = "base-form-question";

const noop = () => {};

type FormBuilderQuestionProps = {
  field: FormFieldConfig;
  property: IBaseProperty;
  pageId: string;
  users: Record<string, UserRef>;
  isFirst: boolean;
  isLast: boolean;
  autoFocus: boolean;
  onAutoFocused: () => void;
  onChange: (patch: Partial<FormFieldConfig>) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
  onReorder: (activeId: string, targetId: string, edge: Edge) => void;
};

export function FormBuilderQuestion({
  field,
  property,
  pageId,
  users,
  isFirst,
  isLast,
  autoFocus,
  onAutoFocused,
  onChange,
  onRemove,
  onMove,
  onReorder,
}: FormBuilderQuestionProps) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [addingDescription, setAddingDescription] = useState(false);
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const onReorderRef = useRef(onReorder);
  useLayoutEffect(() => {
    onReorderRef.current = onReorder;
  });

  useEffect(() => {
    const row = rowRef.current;
    const handle = handleRef.current;
    if (!row || !handle) return;
    return combine(
      draggable({
        element: handle,
        getInitialData: () => ({
          type: FORM_QUESTION_DRAG_TYPE,
          propertyId: property.id,
        }),
        onGenerateDragPreview: ({ nativeSetDragImage }) =>
          nativeSetDragImage?.(row, 0, 0),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element: row,
        canDrop: ({ source }) =>
          source.data.type === FORM_QUESTION_DRAG_TYPE &&
          source.data.propertyId !== property.id,
        getData: ({ input, element }) =>
          attachClosestEdge(
            { propertyId: property.id },
            { input, element, allowedEdges: ["top", "bottom"] },
          ),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: ({ source, self }) => {
          setClosestEdge(null);
          const edge = extractClosestEdge(self.data);
          if (!edge) return;
          onReorderRef.current(
            source.data.propertyId as string,
            property.id,
            edge,
          );
        },
      }),
    );
  }, [property.id]);

  const formField = isFormFieldProperty(property)
    ? toFormField(property, field)
    : null;
  const hasDescription = !!field.description?.trim();

  useEffect(() => {
    if (hasDescription) setAddingDescription(false);
  }, [hasDescription]);

  return (
    <div
      ref={rowRef}
      className={classes.builderQuestion}
      data-dragging={isDragging || undefined}
    >
      <div
        ref={handleRef}
        className={classes.dragHandle}
        title={t("Drag to reorder")}
        aria-hidden="true"
      >
        <IconGripVertical size={16} />
      </div>

      <div
        className={classes.questionCard}
        data-pinned={propertyMenuOpen || actionsMenuOpen || undefined}
      >
        <div className={classes.labelRow}>
          <FormInlineTextarea
            value={field.label?.trim() || property.name}
            onCommit={(next) =>
              onChange({
                label: next && next !== property.name ? next : undefined,
              })
            }
            className={classes.inlineLabel}
            ariaLabel={t("Question")}
            placeholder={property.name}
            maxLength={300}
            singleLine
            autoFocus={autoFocus}
            onAutoFocused={onAutoFocused}
          />
          {field.required && <FormRequiredMark />}
        </div>

        {(hasDescription || addingDescription) && (
          <FormInlineTextarea
            value={field.description ?? ""}
            onCommit={(next) => onChange({ description: next || undefined })}
            className={classes.inlineHelp}
            ariaLabel={t("Question description")}
            placeholder={t("Add a description")}
            maxLength={1000}
            autoFocus={addingDescription && !hasDescription}
            onBlur={(value) => {
              if (!value) setAddingDescription(false);
            }}
          />
        )}

        {formField ? (
          <div className={classes.controlPreview} inert>
            <FormFieldControl
              field={formField}
              value={initialAnswer(formField)}
              onChange={noop}
              controlId={`form-builder-${pageId}-${property.id}`}
              ariaLabelledBy=""
              users={users}
            />
          </div>
        ) : (
          <div className={classes.questionWarning}>
            <IconAlertTriangle size={14} />
            {property.pendingType
              ? t(
                  "This property is being converted. The question will return when it's done.",
                )
              : t(
                  "This property type can't be used in forms. Respondents won't see this question.",
                )}
          </div>
        )}

        {formField && isMemberOnlyField(formField) && (
          <div className={classes.questionHint}>
            <IconUsers size={14} />
            {t("Only shown to signed-in workspace members")}
          </div>
        )}

        <div className={classes.questionToolbar}>
          <FormPropertyChip
            property={property}
            pageId={pageId}
            onOpenChange={setPropertyMenuOpen}
          />
          {!hasDescription && !addingDescription && (
            <UnstyledButton
              className={classes.propertyChip}
              onClick={() => setAddingDescription(true)}
            >
              <IconTextPlus size={14} />
              <span className={classes.propertyChipName}>
                {t("Add description")}
              </span>
            </UnstyledButton>
          )}
          <Switch
            size="xs"
            label={t("Required")}
            checked={field.required === true}
            onChange={(event) =>
              onChange({ required: event.currentTarget.checked || undefined })
            }
          />
          <Menu
            position="bottom-end"
            shadow="md"
            width={200}
            withinPortal
            onChange={setActionsMenuOpen}
          >
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={t("Question actions")}
              >
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconArrowUp size={14} />}
                disabled={isFirst}
                onClick={() => onMove(-1)}
              >
                {t("Move up")}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowDown size={14} />}
                disabled={isLast}
                onClick={() => onMove(1)}
              >
                {t("Move down")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={onRemove}
              >
                {t("Remove from form")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      {closestEdge && <BaseDropEdgeIndicator edge={closestEdge} />}
    </div>
  );
}

function FormPropertyChip({
  property,
  pageId,
  onOpenChange,
}: {
  property: IBaseProperty;
  pageId: string;
  onOpenChange: (opened: boolean) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [dirty, setDirty] = useAtom(
    propertyMenuDirtyAtomFamily(pageId),
  ) as unknown as [boolean, (val: boolean) => void];
  const [closeRequest, setCloseRequest] = useAtom(
    propertyMenuCloseRequestAtomFamily(pageId),
  ) as unknown as [number, (val: number) => void];

  const handleClose = useCallback(() => setOpened(false), []);

  const wasOpenedRef = useRef(opened);
  useEffect(() => {
    if (wasOpenedRef.current && !opened) setDirty(false);
    wasOpenedRef.current = opened;
    onOpenChange(opened);
  }, [opened, setDirty, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      if (dirty) {
        setCloseRequest(closeRequest + 1);
      } else {
        handleClose();
      }
    },
    [dirty, closeRequest, setCloseRequest, handleClose],
  );

  const toggle = useCallback(() => {
    if (opened) {
      handleOpenChange(false);
    } else if (!dirty) {
      setOpened(true);
    }
  }, [opened, dirty, handleOpenChange]);

  const Icon = getDescriptor(property.type)?.icon;
  const isChoice =
    property.type === "select" || property.type === "multiSelect";

  return (
    <Popover
      opened={opened}
      onChange={handleOpenChange}
      onClose={handleClose}
      position="bottom-start"
      shadow="md"
      width={260}
      trapFocus
      returnFocus
      withinPortal
      closeOnClickOutside
      closeOnEscape
    >
      <Popover.Target>
        <UnstyledButton
          className={classes.propertyChip}
          data-active={opened || undefined}
          aria-haspopup="dialog"
          onClick={toggle}
        >
          {Icon && <Icon size={14} />}
          <span className={classes.propertyChipName}>{property.name}</span>
          <IconChevronDown size={12} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <PropertyMenuContent
          property={property}
          opened={opened}
          onClose={handleClose}
          onDirtyChange={setDirty}
          pageId={pageId}
          initialPanel={isChoice && !property.pendingType ? "options" : "main"}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
