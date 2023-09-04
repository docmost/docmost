"use client";

import { useAtom } from "jotai/index";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useQuery } from "@tanstack/react-query";
import { getWorkspaceUsers } from "@/features/workspace/services/workspace-service";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function WorkspaceMembersTable() {
  const [currentUser] = useAtom(currentUserAtom);

  const workspaceUsers = useQuery({
    queryKey: ["workspaceUsers", currentUser.workspace.id],
    queryFn: async () => {
      return await getWorkspaceUsers();
    },
  });

  const { data, isLoading, isSuccess } = workspaceUsers;

  return (
    <>
      {isSuccess &&

        <Table>
          <TableCaption>Your workspace members will appear here.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>

            {
              data['users']?.map((user, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell> <Badge variant="secondary">{user.workspaceRole}</Badge></TableCell>
                </TableRow>
              ))
            }

          </TableBody>
        </Table>
      }
    </>
  );
}
