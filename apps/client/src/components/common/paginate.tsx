import { Button, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";

export interface PagePaginationProps {
  currentPage: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPageChange: (newPage: number) => void;
}

export default function Paginate({
  currentPage,
  hasPrevPage,
  hasNextPage,
  onPageChange,
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
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevPage}
      >
        {t("Prev")}
      </Button>

      <Button
        variant="default"
        size="compact-sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
      >
        {t("Next")}
      </Button>
    </Group>
  );
}
