import { useTranslation } from "react-i18next";
import { PropertyChangeConfirmation } from "./property-change-confirmation";

type RemoveTimeConfirmationProps = {
  propertyName: string;
  description?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveTimeConfirmation({
  propertyName,
  description,
  loading,
  onCancel,
  onConfirm,
}: RemoveTimeConfirmationProps) {
  const { t } = useTranslation();
  return (
    <PropertyChangeConfirmation
      title={t("Remove time from {{name}}?", { name: propertyName })}
      description={description ?? t("Cells keep their day in UTC and lose the time.")}
      confirmLabel={t("Remove time")}
      destructive
      loading={loading}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
