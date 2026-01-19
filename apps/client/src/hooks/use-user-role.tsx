import { useAtom } from "jotai";
import { UserRole } from "@/lib/types";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";

export const useUserRole = () => {
  const [currentUser] = useAtom(currentUserAtom);

  const isAdmin =
    currentUser?.user?.role === UserRole.ADMIN ||
    currentUser?.user?.role === UserRole.OWNER;

  const isOwner = currentUser?.user?.role === UserRole.OWNER;

  const isMember = currentUser?.user?.role === UserRole.MEMBER;

  const isVisitor = currentUser?.user?.role === UserRole.VISITOR;

  return { isAdmin, isOwner, isMember, isVisitor };
};

export default useUserRole;
