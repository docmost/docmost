import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import type { ISpace } from "@/features/space/types/space.types";

export function SpaceAvatar({ name, logo }: Pick<ISpace, "name" | "logo">) {
  return (
    <CustomAvatar
      component="span"
      name={name}
      avatarUrl={logo}
      type={AvatarIconType.SPACE_ICON}
      color="initials"
      variant="filled"
      size={20}
      aria-hidden
    />
  );
}
