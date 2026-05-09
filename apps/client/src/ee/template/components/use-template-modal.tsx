import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ITemplate } from "@/ee/template/types/template.types";
import { useUseTemplateMutation } from "@/ee/template/queries/template-query";
import { buildPageUrl } from "@/features/page/page.utils";
import { DestinationPickerModal } from "@/components/ui/destination-picker/destination-picker-modal";
import { DestinationSelection } from "@/components/ui/destination-picker/destination-picker.types";

type UseTemplateModalProps = {
  template: ITemplate;
  opened: boolean;
  onClose: () => void;
};

export default function UseTemplateModal({
  template,
  opened,
  onClose,
}: UseTemplateModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const useTemplateMutation = useUseTemplateMutation();

  const handleSelect = async (selection: DestinationSelection) => {
    const spaceId = selection.spaceId;
    const parentPageId =
      selection.type === "page" ? selection.pageId : undefined;

    try {
      const page = await useTemplateMutation.mutateAsync({
        templateId: template.id,
        spaceId,
        parentPageId,
      });

      onClose();

      if (page?.slugId) {
        const space = selection.space;
        if (space?.slug) {
          navigate(buildPageUrl(space.slug, page.slugId, page.title));
        }
      }
    } catch {
      // error notification handled by mutation's onError
    }
  };

  return (
    <DestinationPickerModal
      opened={opened}
      onClose={onClose}
      title={t("Choose destination")}
      actionLabel={t("Create page")}
      onSelect={handleSelect}
      loading={useTemplateMutation.isPending}
    />
  );
}
