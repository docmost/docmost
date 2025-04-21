import { Table, Text } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";

interface NoTableResultsProps {
  colSpan: number;
}
export default function NoTableResults({ colSpan }: NoTableResultsProps) {
  const { t } = useTranslation();
  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <Text fw={500} c="dimmed" ta="center">
          {t("No results found...")}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
