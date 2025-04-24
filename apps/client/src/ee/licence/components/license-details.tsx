import { isLicenseExpired } from "@/ee/licence/license.utils.ts";
import { useLicenseInfo } from "@/ee/licence/queries/license-query.ts";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Badge, Table } from "@mantine/core";
import { format } from "date-fns";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";

export default function LicenseDetails() {
  const { data: license, isError } = useLicenseInfo();
  const [workspace] = useAtom(workspaceAtom);
  const { t } = useTranslation();

  if (!license) {
    return null;
  }
  if (isError) {
    return null;
  }

  return (
    <Table.ScrollContainer minWidth={500} py="md">
      <Table
        variant="vertical"
        verticalSpacing="sm"
        layout="fixed"
        withTableBorder
      >
        <Table.Caption>
          {t('Contact sales@docmost.com for support and enquiries.')}
        </Table.Caption>
        <Table.Tbody>
          <Table.Tr>
            <Table.Th w={160}>{t('Edition')}</Table.Th>
            <Table.Td>
              {t("Enterprise")} {license.trial && <Badge color="green">{t("Trial")}</Badge>}
            </Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>{t("Licensed to")}</Table.Th>
            <Table.Td>{license.customerName}</Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>{t("Seat count")}</Table.Th>
            <Table.Td>
              {license.seatCount} ({workspace?.memberCount} {t("used")})
            </Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>{t("Issued at")}</Table.Th>
            <Table.Td>{format(license.issuedAt, "dd MMMM, yyyy")}</Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>{t("Expires at")}</Table.Th>
            <Table.Td>{format(license.expiresAt, "dd MMMM, yyyy")}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>{t("License ID")}</Table.Th>
            <Table.Td>{license.id}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>{t("Status")}</Table.Th>
            <Table.Td>
              {isLicenseExpired(license) ? (
                <Badge color="red" variant="light">
                  {t("Expired")}
                </Badge>
              ) : (
                <Badge color="blue" variant="light">
                  {t("Valid")}
                </Badge>
              )}
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
