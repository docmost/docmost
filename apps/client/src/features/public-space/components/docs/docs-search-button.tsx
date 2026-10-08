import { IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { platformModifierLabel } from "@/lib";
import styles from "./docs.module.css";

type DocsSearchButtonProps = {
  onClick: () => void;
};

export default function DocsSearchButton({ onClick }: DocsSearchButtonProps) {
  const { t } = useTranslation();

  return (
    <button type="button" className={styles.searchButton} onClick={onClick}>
      <IconSearch size={15} stroke={2} aria-hidden />
      <span className={styles.searchLabel}>{t("Search")}</span>
      <span className={styles.searchKbd} aria-hidden>
        {platformModifierLabel} K
      </span>
    </button>
  );
}
