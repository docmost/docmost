import { Button, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";

export interface PagePaginationProps {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function Paginate({
  hasPrevPage,
  hasNextPage,
  onPrev,
  onNext,
}: PagePaginationProps) {
  const { t } = useTranslation();

  if (!hasPrevPage && !hasNextPage) {
    return null;
  }

  return (
    <Group mt="md" justify="flex-end">
      <Button
        variant="default"
        size="compact-sm"
        onClick={onPrev}
        disabled={!hasPrevPage}
      >
        {t("Prev")}
      </Button>

      <Button
        variant="default"
        size="compact-sm"
        onClick={onNext}
        disabled={!hasNextPage}
      >
        {t("Next")}
      </Button>
    </Group>
  );
}
