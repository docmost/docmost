import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Button, Group, Text, ThemeIcon } from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconEye,
  IconRotate2,
} from "@tabler/icons-react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  FormFieldError,
  FormRespondent,
  PublicForm,
  PublicFormField,
  UserRef,
} from "@/ee/base/types/base.types";
import {
  FormAnswers,
  buildInitialAnswers,
  buildSubmissionAnswers,
  formFieldErrorMessage,
  initialAnswer,
  validateFormAnswers,
} from "@/ee/base/components/form/form-definition";
import { FormFieldControl } from "@/ee/base/components/form/form-field-control";
import { FormRichText } from "@/ee/base/components/form/form-rich-text";
import { FormRequiredMark } from "@/ee/base/components/form/form-required-mark";
import { FormSubmitButton } from "@/ee/base/components/form/form-submit-button";
import classes from "@/ee/base/styles/form.module.css";

export type FormUnavailableStatus = "closed" | "signInRequired" | "notFound";

const UNAVAILABLE_BY_STATUS: Record<number, FormUnavailableStatus> = {
  401: "signInRequired",
  403: "closed",
  404: "notFound",
};

type FormFillProps = {
  form: PublicForm;
  mode: "live" | "preview" | "readOnly";
  respondent?: FormRespondent | null;
  users?: Record<string, UserRef>;
  onSubmit?: (answers: FormAnswers) => Promise<void>;
  onUnavailable?: (status: FormUnavailableStatus) => void;
  onExitPreview?: () => void;
};

export function FormFill({
  form,
  mode,
  respondent,
  users,
  onSubmit,
  onUnavailable,
  onExitPreview,
}: FormFillProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<FormAnswers>(() =>
    buildInitialAnswers(form.fields),
  );
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<
    Record<string, FormFieldError>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState(false);

  const currentAnswers = useMemo<FormAnswers>(
    () =>
      Object.fromEntries(
        form.fields.map((field) => [
          field.propertyId,
          field.propertyId in answers
            ? answers[field.propertyId]
            : initialAnswer(field),
        ]),
      ),
    [form.fields, answers],
  );

  const errors = useMemo(
    () =>
      attempted
        ? {
            ...validateFormAnswers(form.fields, currentAnswers),
            ...serverErrors,
          }
        : serverErrors,
    [attempted, form.fields, currentAnswers, serverErrors],
  );

  useEffect(() => {
    if (submitted) successTitleRef.current?.focus({ preventScroll: true });
  }, [submitted]);

  const questionId = (propertyId: string) => `${idPrefix}-${propertyId}`;

  const focusFirstError = (fieldErrors: Record<string, FormFieldError>) => {
    const first = form.fields.find((field) => fieldErrors[field.propertyId]);
    if (!first) return;
    const question = document.getElementById(questionId(first.propertyId));
    question?.scrollIntoView({ block: "center" });
    question
      ?.querySelector<HTMLElement>(
        "input:not([type='hidden']):not([tabindex='-1']), textarea, button:not([tabindex='-1'])",
      )
      ?.focus({ preventScroll: true });
  };

  const handleChange = (field: PublicFormField, value: unknown) => {
    setTouched(true);
    setAnswers((prev) => ({ ...prev, [field.propertyId]: value }));
    if (serverErrors[field.propertyId]) {
      setServerErrors((prev) => {
        const next = { ...prev };
        delete next[field.propertyId];
        return next;
      });
    }
  };

  const finish = () => {
    setSubmitted(true);
    rootRef.current?.scrollIntoView({ block: "start" });
  };

  const reset = () => {
    setAnswers(buildInitialAnswers(form.fields));
    setTouched(false);
    setAttempted(false);
    setServerErrors({});
    setFormError(null);
    setSubmitted(false);
  };

  const handleSubmitError = (error: unknown) => {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const fieldErrors: Record<string, FormFieldError> | undefined =
      status === 400 && isAxiosError(error)
        ? error.response?.data?.fieldErrors
        : undefined;

    if (fieldErrors) {
      const known = Object.fromEntries(
        Object.entries(fieldErrors).filter(([propertyId]) =>
          form.fields.some((field) => field.propertyId === propertyId),
        ),
      );
      setServerErrors(known);
      if (Object.keys(known).length < Object.keys(fieldErrors).length) {
        setFormError(
          t("This form has changed. Reload the page to see the latest version."),
        );
      }
      focusFirstError(known);
      return;
    }

    const unavailable = status ? UNAVAILABLE_BY_STATUS[status] : undefined;
    if (unavailable && onUnavailable) {
      onUnavailable(unavailable);
      return;
    }

    if (status === 429) {
      setFormError(
        t("You're sending responses too quickly. Wait a moment and try again."),
      );
      return;
    }

    setFormError(
      getApiErrorMessage(error, t("Something went wrong. Please try again.")),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (
      event.key === "Enter" &&
      !event.nativeEvent.isComposing &&
      event.target instanceof HTMLInputElement
    ) {
      event.preventDefault();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setAttempted(true);
    setFormError(null);
    const fieldErrors = validateFormAnswers(form.fields, currentAnswers);
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstError(fieldErrors);
      return;
    }

    if (!onSubmit) {
      finish();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(buildSubmissionAnswers(form.fields, currentAnswers));
      finish();
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={rootRef} className={classes.form}>
      {mode === "preview" && (
        <div className={classes.previewBanner}>
          <IconEye size={16} stroke={1.75} />
          <Text size="sm" className={classes.previewBannerText}>
            {t("You're previewing this form. Submitted responses are saved.")}
          </Text>
          {onExitPreview && (
            <Button size="compact-xs" variant="subtle" onClick={onExitPreview}>
              {t("Exit preview")}
            </Button>
          )}
        </div>
      )}

      {submitted ? (
        <div className={classes.success} role="status">
          <ThemeIcon size={56} radius="xl" variant="light" color="green">
            <IconCircleCheck size={32} stroke={1.5} />
          </ThemeIcon>
          <h2
            ref={successTitleRef}
            tabIndex={-1}
            className={classes.successTitle}
          >
            {form.successTitle || t("Thank you!")}
          </h2>
          <FormRichText
            text={form.successMessage || t("Your response has been recorded.")}
            className={classes.successMessage}
          />
          {form.allowResubmit && (
            <Button variant="default" onClick={reset}>
              {t("Submit another response")}
            </Button>
          )}
          {mode === "preview" && !form.allowResubmit && (
            <Button variant="default" onClick={reset}>
              {t("Back to form")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <header className={classes.header}>
            <h1 className={classes.title}>
              {form.title || t("Untitled form")}
            </h1>
            {form.description && (
              <FormRichText
                text={form.description}
                className={classes.description}
              />
            )}
            {respondent && (
              <div className={classes.respondent}>
                <CustomAvatar
                  avatarUrl={respondent.avatarUrl ?? ""}
                  name={respondent.name || respondent.email}
                  size={24}
                  radius="xl"
                />
                <Text size="sm" c="dimmed">
                  {t("Responding as {{name}}", {
                    name: respondent.name
                      ? `${respondent.name} (${respondent.email})`
                      : respondent.email,
                  })}
                </Text>
              </div>
            )}
          </header>

          <form
            noValidate
            autoComplete="off"
            data-form-type="other"
            onKeyDown={handleKeyDown}
            onSubmit={handleSubmit}
            className={classes.body}
          >
            {form.fields.length === 0 ? (
              <Text c="dimmed">
                {t("This form doesn't have any questions yet.")}
              </Text>
            ) : (
              <div className={classes.questions} inert={mode === "readOnly"}>
                {form.fields.map((field) => (
                  <FormQuestion
                    key={field.propertyId}
                    id={questionId(field.propertyId)}
                    field={field}
                    value={currentAnswers[field.propertyId]}
                    error={errors[field.propertyId]}
                    users={users}
                    onChange={(value) => handleChange(field, value)}
                  />
                ))}
              </div>
            )}

            {formError && (
              <Alert
                variant="light"
                color="red"
                icon={<IconAlertTriangle size={16} />}
              >
                {formError}
              </Alert>
            )}

            {mode !== "readOnly" && (
              <Group gap="sm">
                <FormSubmitButton
                  type="submit"
                  label={form.submitLabel || t("Submit")}
                  loading={submitting}
                  disabled={form.fields.length === 0}
                />
                {touched && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="sm"
                    radius="md"
                    leftSection={<IconRotate2 size={16} />}
                    onClick={reset}
                  >
                    {t("Clear form")}
                  </Button>
                )}
              </Group>
            )}
          </form>
        </>
      )}
    </div>
  );
}

type FormQuestionProps = {
  id: string;
  field: PublicFormField;
  value: unknown;
  error?: FormFieldError;
  users?: Record<string, UserRef>;
  onChange: (value: unknown) => void;
};

function FormQuestion({
  id,
  field,
  value,
  error,
  users,
  onChange,
}: FormQuestionProps) {
  const { t } = useTranslation();
  const controlId = `${id}-control`;
  const labelId = `${id}-label`;
  const descriptionId = field.description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div id={id} className={classes.question}>
      <div className={classes.questionHeader}>
        <label id={labelId} htmlFor={controlId} className={classes.questionLabel}>
          {field.label}
          {field.required && <FormRequiredMark />}
        </label>
        {field.description && (
          <FormRichText
            id={descriptionId}
            text={field.description}
            className={classes.questionDescription}
          />
        )}
      </div>
      <FormFieldControl
        field={field}
        value={value}
        onChange={onChange}
        controlId={controlId}
        ariaLabelledBy={labelId}
        ariaDescribedBy={describedBy}
        invalid={!!error}
        users={users}
      />
      {error && (
        <div id={errorId} className={classes.errorText} role="alert">
          <IconAlertCircle size={15} stroke={2} />
          {formFieldErrorMessage(t, field, error)}
        </div>
      )}
    </div>
  );
}
