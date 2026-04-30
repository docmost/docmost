import {
  currentUserAtom,
  userAtom,
} from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useAtom } from "jotai";
import { Button, Group, rem, Stack } from "@mantine/core";
import { IconBrandGit } from "@tabler/icons-react";
import AvatarUploader from "@/components/common/avatar-uploader.tsx";
import {
  uploadUserAvatar,
  removeAvatar,
} from "@/features/attachments/services/attachment-service.ts";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { useOAuthAvatar } from "@/features/user/services/user-service.ts";
import { notifications } from "@mantine/notifications";

function MicrosoftIcon({ size = 16 }: { size?: number }) {
  const iconSize = rem(size);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 23 23"
      style={{ width: iconSize, height: iconSize }}
    >
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export default function AccountAvatar() {
  const [isLoading, setIsLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState<
    "gitea" | "azure" | null
  >(null);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);
  const oauthAvatars = currentUser?.user.settings?.oauthAvatars;

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

  const handleUseOAuthAvatar = async (provider: "gitea" | "azure") => {
    setProviderLoading(provider);
    try {
      const user = await useOAuthAvatar(provider);
      setUser(user);
    } catch (err) {
      console.error(err);
      notifications.show({
        message: "Failed to update avatar",
        color: "red",
      });
    } finally {
      setProviderLoading(null);
    }
  };

  return (
    <Stack gap="sm" align="flex-start">
      <AvatarUploader
        currentImageUrl={currentUser?.user.avatarUrl}
        fallbackName={currentUser?.user.name}
        size="60px"
        type={AvatarIconType.AVATAR}
        onUpload={handleUpload}
        onRemove={handleRemove}
        isLoading={isLoading}
      />

      {(oauthAvatars?.gitea || oauthAvatars?.azure) && (
        <Group gap="xs">
          {oauthAvatars?.gitea && (
            <Button
              size="xs"
              variant="default"
              leftSection={<IconBrandGit size={16} />}
              loading={providerLoading === "gitea"}
              disabled={Boolean(providerLoading)}
              onClick={() => handleUseOAuthAvatar("gitea")}
            >
              Use Gitea avatar
            </Button>
          )}

          {oauthAvatars?.azure && (
            <Button
              size="xs"
              variant="default"
              leftSection={<MicrosoftIcon size={16} />}
              loading={providerLoading === "azure"}
              disabled={Boolean(providerLoading)}
              onClick={() => handleUseOAuthAvatar("azure")}
            >
              Use Azure avatar
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
