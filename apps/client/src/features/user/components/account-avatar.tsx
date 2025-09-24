import {
  currentUserAtom,
  userAtom,
} from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useAtom } from "jotai";
import AvatarUploader from "@/components/common/avatar-uploader.tsx";
import {
  uploadUserAvatar,
  removeAvatar,
} from "@/features/attachments/services/attachment-service.ts";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";

export default function AccountAvatar() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);

  const handleUpload = async (selectedFile: File) => {
    setIsLoading(true);
    try {
      const avatar = await uploadUserAvatar(selectedFile);
      if (currentUser?.user) {
        setUser({ ...currentUser.user, avatarUrl: avatar.fileName });
      }
    } catch (err) {
      // skip
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      await removeAvatar();
      if (currentUser?.user) {
        setUser({ ...currentUser.user, avatarUrl: null });
      }
    } catch (err) {
      // skip
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AvatarUploader
      currentImageUrl={currentUser?.user.avatarUrl}
      fallbackName={currentUser?.user.name}
      size="60px"
      type={AvatarIconType.AVATAR}
      onUpload={handleUpload}
      onRemove={handleRemove}
      isLoading={isLoading}
    />
  );
}
