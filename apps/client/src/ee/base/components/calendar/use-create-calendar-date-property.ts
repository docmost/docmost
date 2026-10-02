import { useIsMutating } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { useCreatePropertyMutation } from "@/ee/base/queries/base-property-query";
import { getAvailablePropertyName } from "@/ee/base/utils/property-name";

export function useCreateCalendarDateProperty(pageId: string, properties: IBaseProperty[]) {
  const { t } = useTranslation();
  const mutationKey = ["create-calendar-date-property", pageId];
  const createProperty = useCreatePropertyMutation(mutationKey);
  const isCreating = useIsMutating({ mutationKey }) > 0;

  const createDateProperty = (onCreated: (property: IBaseProperty) => void) => {
    if (queryClient.isMutating({ mutationKey }) > 0) return;
    createProperty.mutate(
      {
        pageId,
        name: getAvailablePropertyName(t("Date"), properties),
        type: "date",
      },
      { onSuccess: onCreated },
    );
  };

  return { createDateProperty, isCreating };
}
