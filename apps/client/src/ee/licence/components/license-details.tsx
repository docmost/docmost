import { Badge, Table } from "@mantine/core";
import { useLicenseInfo } from "@/ee/licence/queries/license-query.ts";
import { isLicenseExpired } from "@/ee/licence/license.utils.ts";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale.ts";

export default function LicenseDetails() {
  const { data: license, isError } = useLicenseInfo();
  const [workspace] = useAtom(workspaceAtom);
  const locale = useDateFnsLocale();

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
          Contact sales@docmost.com for support and enquiries.
        </Table.Caption>
        <Table.Tbody>
          <Table.Tr>
            <Table.Th w={160}>Edition</Table.Th>
            <Table.Td>
              {license.licenseType === "business" ? "Business" : "Enterprise"}{" "}
              {license.trial && <Badge color="green">Trial</Badge>}
            </Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>Licensed to</Table.Th>
            <Table.Td>{license.customerName}</Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>Seat count</Table.Th>
            <Table.Td>
              {license.seatCount} ({workspace?.memberCount} used)
            </Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>Issued at</Table.Th>
            <Table.Td>
              {formatLocalized(license.issuedAt, "dd MMMM, yyyy", "PPP", locale)}
            </Table.Td>
          </Table.Tr>

          <Table.Tr>
            <Table.Th>Expires at</Table.Th>
            <Table.Td>
              {formatLocalized(license.expiresAt, "dd MMMM, yyyy", "PPP", locale)}
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>License ID</Table.Th>
            <Table.Td>{license.id}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Status</Table.Th>
            <Table.Td>
              {isLicenseExpired(license) ? (
                <Badge color="red" variant="light">
                  Expired
                </Badge>
              ) : (
                <Badge color="blue" variant="light">
                  Valid
                </Badge>
              )}
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
