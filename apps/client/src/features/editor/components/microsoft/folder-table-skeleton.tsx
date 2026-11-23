import { Skeleton, Table } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  FOLDER_SKELETON_NAME_WIDTHS,
  FOLDER_SKELETON_ROWS,
} from "./folder-table.constants";
import classes from "./microsoft-folder.module.css";

type Props = { rows?: number };

export function FolderTableSkeleton({ rows = FOLDER_SKELETON_ROWS }: Props) {
  const { t } = useTranslation();
  const columns = [t("Name"), t("Modified"), t("Modified By")];

  return (
    <div
      className={classes.frame}
      role="status"
      aria-busy="true"
      aria-label={t("Loading folder")}
    >
      <div className={classes.header}>
        <Skeleton height={16} width={16} />
        <div className={classes.breadcrumbs}>
          <Skeleton height={12} width="40%" />
        </div>
        <Skeleton height={18} width={18} />
      </div>

      <div className={classes.tableScroll}>
        <Table className={classes.table}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((label) => (
                <Table.Th key={label}>
                  <span className={classes.sortButton}>{label}</span>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from({ length: rows }, (_, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <div className={classes.nameCell}>
                    <Skeleton height={18} width={18} />
                    <Skeleton
                      height={12}
                      width={
                        FOLDER_SKELETON_NAME_WIDTHS[
                          index % FOLDER_SKELETON_NAME_WIDTHS.length
                        ]
                      }
                    />
                  </div>
                </Table.Td>
                <Table.Td className={classes.metaCell}>
                  <Skeleton height={12} width={70} />
                </Table.Td>
                <Table.Td className={classes.metaCell}>
                  <Skeleton height={12} width={90} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </div>
  );
}
