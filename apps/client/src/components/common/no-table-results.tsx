import { Table, Text } from "@mantine/core";
import React from "react";
import { useTranslation } from "react-i18next";

interface NoTableResultsProps {
  colSpan: number;
  text?: string;
}
export default function NoTableResults({ colSpan, text }: NoTableResultsProps) {
  const { t } = useTranslation();
  return (
    <Table.Tr>
      <Table.Td colSpan={colSpan}>
        <Text fw={500} c="dimmed" ta="center">
          {text || t("No results found...")}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
