import type { TFunction } from "i18next";
import {
  BasePropertyType,
  FormConfig,
  FormFieldConfig,
  FormFieldError,
  FormFieldType,
  IBaseProperty,
  NumberTypeOptions,
  PersonTypeOptions,
  PublicForm,
  PublicFormChoice,
  PublicFormField,
  SelectTypeOptions,
} from "@/ee/base/types/base.types";

export type FormAnswers = Record<string, unknown>;

export const FORM_FIELD_TYPES: ReadonlySet<BasePropertyType> =
  new Set<BasePropertyType>([
    "text",
    "longText",
    "number",
    "select",
    "multiSelect",
    "date",
    "checkbox",
    "url",
    "email",
    "person",
  ]);

const MEMBER_ONLY_FIELD_TYPES: ReadonlySet<FormFieldType> =
  new Set<FormFieldType>(["person"]);

export const CHOICE_LIST_LIMIT = 10;

export const MAX_FORM_FIELDS = 100;

export const AUTOFILL_OPT_OUT = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

const TEXT_MAX_LENGTH: Partial<Record<FormFieldType, number>> = {
  text: 1000,
  longText: 25000,
  url: 2048,
  email: 320,
};

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isFormFieldProperty(property: IBaseProperty): boolean {
  return FORM_FIELD_TYPES.has(property.type) && !property.pendingType;
}

export function isMemberOnlyField(field: PublicFormField): boolean {
  return MEMBER_ONLY_FIELD_TYPES.has(field.type);
}

export function toFormField(
  property: IBaseProperty,
  config: FormFieldConfig,
): PublicFormField {
  const type = property.type as FormFieldType;
  const field: PublicFormField = {
    propertyId: property.id,
    type,
    label: config.label?.trim() || property.name,
    description: config.description?.trim() || null,
    required: config.required === true,
    defaultValue: resolveFieldDefault(property),
  };

  if (type === "select" || type === "multiSelect") {
    field.choices = orderedChoices(property.typeOptions as SelectTypeOptions);
  }
  if (type === "number") {
    const { format, precision, currencyCode, currencySymbol } =
      (property.typeOptions ?? {}) as NumberTypeOptions;
    field.numberFormat = { format, precision, currencyCode, currencySymbol };
  }
  if (type === "person") {
    field.allowMultiple =
      (property.typeOptions as PersonTypeOptions)?.allowMultiple === true;
  }

  return field;
}

export function buildFormDefinition(
  form: FormConfig | undefined,
  properties: IBaseProperty[],
  pageTitle: string | undefined,
): PublicForm {
  const propertiesById = new Map(properties.map((p) => [p.id, p]));
  const fields: PublicFormField[] = [];
  for (const config of form?.fields ?? []) {
    const property = propertiesById.get(config.propertyId);
    if (property && isFormFieldProperty(property)) {
      fields.push(toFormField(property, config));
    }
  }

  return {
    title: form?.title?.trim() || pageTitle?.trim() || null,
    description: form?.description?.trim() || null,
    submitLabel: form?.submitLabel?.trim() || null,
    successTitle: form?.successTitle?.trim() || null,
    successMessage: form?.successMessage?.trim() || null,
    allowResubmit: form?.allowResubmit !== false,
    access: "public",
    fields,
  };
}

function orderedChoices(
  options: SelectTypeOptions | undefined,
): PublicFormChoice[] {
  const choices = options?.choices ?? [];
  const choicesById = new Map(choices.map((c) => [c.id, c]));
  const ordered = new Map<string, PublicFormChoice>();
  for (const id of options?.choiceOrder ?? []) {
    const choice = choicesById.get(id);
    if (choice) ordered.set(id, choice);
  }
  for (const choice of choices) {
    if (!ordered.has(choice.id)) ordered.set(choice.id, choice);
  }
  return Array.from(ordered.values(), ({ id, name, color }) => ({
    id,
    name,
    color,
  }));
}

function resolveFieldDefault(property: IBaseProperty): unknown {
  const options = (property.typeOptions ?? {}) as {
    defaultValue?: unknown;
    choices?: { id: string }[];
  };
  const value = options.defaultValue;

  if (property.type === "checkbox") return value === true;
  if (value === undefined || value === null) return null;

  if (property.type === "select" || property.type === "multiSelect") {
    const ids = new Set((options.choices ?? []).map((c) => c.id));
    if (property.type === "multiSelect") {
      const live = (Array.isArray(value) ? value : [value]).filter(
        (id): id is string => typeof id === "string" && ids.has(id),
      );
      return live.length ? live : null;
    }
    return typeof value === "string" && ids.has(value) ? value : null;
  }

  if (property.type === "number") {
    return typeof value === "number" ? value : null;
  }

  if (property.type === "person") {
    const ids = (Array.isArray(value) ? value : [value]).filter(
      (id): id is string => typeof id === "string",
    );
    if (ids.length === 0) return null;
    return (property.typeOptions as PersonTypeOptions)?.allowMultiple
      ? ids
      : ids[0];
  }

  return typeof value === "string" && value.trim() ? value : null;
}

export function initialAnswer(field: PublicFormField): unknown {
  switch (field.type) {
    case "checkbox":
      return field.defaultValue === true;
    case "multiSelect":
      return Array.isArray(field.defaultValue) ? field.defaultValue : [];
    case "person":
      if (field.allowMultiple) {
        return Array.isArray(field.defaultValue) ? field.defaultValue : [];
      }
      return typeof field.defaultValue === "string" ? field.defaultValue : null;
    case "select":
    case "date":
      return typeof field.defaultValue === "string" ? field.defaultValue : null;
    case "number":
      return typeof field.defaultValue === "number" ? field.defaultValue : "";
    default:
      return typeof field.defaultValue === "string" ? field.defaultValue : "";
  }
}

export function buildInitialAnswers(fields: PublicFormField[]): FormAnswers {
  return Object.fromEntries(
    fields.map((field) => [field.propertyId, initialAnswer(field)]),
  );
}

const INVALID = Symbol("invalid");

function normalizeAnswer(field: PublicFormField, raw: unknown): unknown {
  if (field.type === "checkbox") return raw === true;
  if (raw === undefined || raw === null) return undefined;

  if (field.type === "number") {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : INVALID;
    if (typeof raw !== "string") return INVALID;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : INVALID;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed ? trimmed : undefined;
  }

  if (Array.isArray(raw)) return raw.length ? raw : undefined;

  return raw;
}

function isValidAnswer(field: PublicFormField, value: unknown): boolean {
  if (
    typeof value === "string" &&
    value.length > (TEXT_MAX_LENGTH[field.type] ?? Infinity)
  ) {
    return false;
  }

  switch (field.type) {
    case "text":
    case "longText":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "select":
      return (
        typeof value === "string" &&
        (field.choices ?? []).some((c) => c.id === value)
      );
    case "multiSelect": {
      const ids = new Set((field.choices ?? []).map((c) => c.id));
      return (
        Array.isArray(value) &&
        value.length <= 100 &&
        value.every((id) => typeof id === "string" && ids.has(id))
      );
    }
    case "date":
      return isIsoDate(value);
    case "url":
      return isHttpUrl(value);
    case "email":
      return typeof value === "string" && EMAIL.test(value);
    case "checkbox":
      return typeof value === "boolean";
    case "person":
      return field.allowMultiple
        ? Array.isArray(value) &&
            value.length <= 100 &&
            value.every((id) => typeof id === "string")
        : typeof value === "string";
  }
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const day = value.slice(0, 10);
  const calendarDay = new Date(`${day}T00:00:00Z`);
  return (
    !Number.isNaN(calendarDay.getTime()) &&
    calendarDay.toISOString().slice(0, 10) === day &&
    Number.isFinite(Date.parse(value))
  );
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function validateFormAnswers(
  fields: PublicFormField[],
  answers: FormAnswers,
): Record<string, FormFieldError> {
  const errors: Record<string, FormFieldError> = {};
  for (const field of fields) {
    const value = normalizeAnswer(field, answers[field.propertyId]);
    if (value === INVALID) {
      errors[field.propertyId] = "invalid";
    } else if (value === undefined || (field.type === "checkbox" && !value)) {
      if (field.required) errors[field.propertyId] = "required";
    } else if (!isValidAnswer(field, value)) {
      errors[field.propertyId] = "invalid";
    }
  }
  return errors;
}

export function buildSubmissionAnswers(
  fields: PublicFormField[],
  answers: FormAnswers,
): FormAnswers {
  const submission: FormAnswers = {};
  for (const field of fields) {
    const value = normalizeAnswer(field, answers[field.propertyId]);
    if (value !== undefined && value !== INVALID) {
      submission[field.propertyId] = value;
    }
  }
  return submission;
}

export function formFieldErrorMessage(
  t: TFunction,
  field: PublicFormField,
  error: FormFieldError,
): string {
  if (error === "required") return t("This question is required");
  switch (field.type) {
    case "email":
      return t("Enter a valid email address");
    case "url":
      return t("Enter a valid link starting with http:// or https://");
    case "number":
      return t("Enter a valid number");
    case "date":
      return t("Enter a valid date");
    case "text":
    case "longText":
      return t("This answer is too long");
    case "select":
    case "multiSelect":
      return t("Select one of the available options");
    case "person":
      return t("Select people from this workspace");
    default:
      return t("This answer isn't valid");
  }
}
