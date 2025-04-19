import { Outlet } from "react-router-dom";
import ShareShell from "@/features/share/components/share-shell.tsx";

export default function ShareLayout() {
  return (
    <ShareShell>
      <Outlet />
    </ShareShell>
  );
}
