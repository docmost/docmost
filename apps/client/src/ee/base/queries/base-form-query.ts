import { useCallback, useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getFormShare,
  getPublicForm,
  submitFormPreview,
  submitPublicForm,
  updateFormShare,
} from "@/ee/base/services/base-form-service";
import { updateView } from "@/ee/base/services/base-service";
import { newRequestId } from "@/ee/base/queries/base-row-query";
import {
  FormConfig,
  FormShareInfo,
  IBase,
  IBaseView,
  PublicFormResponse,
  SubmitFormPreviewInput,
  SubmitPublicFormInput,
  UpdateFormShareInput,
} from "@/ee/base/types/base.types";

export function formShareQueryKey(pageId: string, viewId: string) {
  return ["base-form-share", pageId, viewId];
}

function publicFormQueryKey(key: string | undefined) {
  return ["public-form", key];
}

export function invalidatePublicFormForView(pageId: string, viewId: string) {
  const key = queryClient.getQueryData<FormShareInfo>(
    formShareQueryKey(pageId, viewId),
  )?.key;
  if (key) {
    queryClient.invalidateQueries({ queryKey: publicFormQueryKey(key) });
  }
}

export function useFormShareQuery(pageId: string, viewId: string | undefined) {
  return useQuery<FormShareInfo, Error>({
    queryKey: formShareQueryKey(pageId, viewId ?? ""),
    queryFn: () => getFormShare(pageId, viewId!),
    enabled: !!pageId && !!viewId,
    refetchOnMount: true,
  });
}

export function useUpdateFormShareMutation(viewId: string) {
  const { t } = useTranslation();
  return useMutation<FormShareInfo, Error, UpdateFormShareInput>({
    scope: { id: `base-form-share:${viewId}` },
    mutationFn: (data) =>
      updateFormShare({ ...data, requestId: newRequestId() }),
    onSuccess: (share, variables) => {
      queryClient.setQueryData(
        formShareQueryKey(variables.pageId, variables.viewId),
        share,
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update form sharing")),
        color: "red",
      });
    },
  });
}

export function usePublicFormQuery(key: string | undefined) {
  const query = useQuery<PublicFormResponse, Error>({
    queryKey: publicFormQueryKey(key),
    queryFn: ({ signal }) => getPublicForm(key!, signal),
    enabled: !!key,
    retry: false,
    // Respondents do not receive the author's socket updates. Revalidate when
    // they return so cached questions and sharing permissions are not reused.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });

  const [validated, setValidated] = useState({ key, succeeded: false });
  const succeeded = query.isSuccess && query.isFetchedAfterMount;
  if (validated.key !== key) {
    setValidated({ key, succeeded });
  } else if (succeeded && !validated.succeeded) {
    setValidated({ key, succeeded: true });
  }

  // A failed refetch also sets isFetchedAfterMount. Only a successful check
  // during this visit may initialize a form; later transient errors can keep
  // that already-initialized draft mounted, hidden until a retry succeeds.
  return {
    ...query,
    hasValidatedData:
      succeeded || (validated.key === key && validated.succeeded),
  };
}

export function useSubmitPublicFormMutation() {
  return useMutation<void, Error, SubmitPublicFormInput>({
    mutationFn: (data) => submitPublicForm(data),
  });
}

export function useSubmitFormPreviewMutation() {
  return useMutation<void, Error, SubmitFormPreviewInput>({
    mutationFn: (data) => submitFormPreview(data),
  });
}

const pendingForms = new Map<string, FormConfig>();
type FormEdit = { expectedForm: FormConfig; form: FormConfig };

export function useUpdateFormConfig(pageId: string, viewId: string) {
  const { t } = useTranslation();
  const { mutate } = useMutation<IBaseView, Error, FormEdit>({
    scope: { id: `base-form-config:${viewId}` },
    mutationFn: ({ form, expectedForm }) =>
      updateView({
        viewId,
        pageId,
        config: { form },
        expectedForm,
        requestId: newRequestId(),
      }),
    onMutate: async ({ form }) => {
      await queryClient.cancelQueries({ queryKey: ["bases", pageId] });
      queryClient.setQueryData<IBase>(["bases", pageId], (old) =>
        old
          ? {
              ...old,
              views: old.views.map((v) =>
                v.id === viewId ? { ...v, config: { ...v.config, form } } : v,
              ),
            }
          : old,
      );
    },
    onSuccess: (view, { form }) => {
      if (pendingForms.get(viewId) !== form) return;
      pendingForms.delete(viewId);
      queryClient.setQueryData<IBase>(["bases", pageId], (old) =>
        old
          ? {
              ...old,
              views: old.views.map((v) => (v.id === view.id ? view : v)),
            }
          : old,
      );
    },
    onError: (error, { form }) => {
      if (pendingForms.get(viewId) === form) pendingForms.delete(viewId);
      queryClient.invalidateQueries({ queryKey: ["bases", pageId] });
      notifications.show({
        message: isAxiosError(error) && error.response?.status === 409
          ? t("The form changed. Reload it and try again.")
          : getApiErrorMessage(error, t("Failed to update form")),
        color: "red",
      });
    },
  });

  return useCallback(
    (recipe: (form: FormConfig) => FormConfig) => {
      const base = queryClient.getQueryData<IBase>(["bases", pageId]);
      const view = base?.views.find((v) => v.id === viewId);
      if (!view) return;
      const current = pendingForms.get(viewId) ?? view.config?.form ?? {};
      const next = recipe(current);
      if (next === current) return;
      pendingForms.set(viewId, next);
      mutate({ form: next, expectedForm: current });
    },
    [pageId, viewId, mutate],
  );
}
