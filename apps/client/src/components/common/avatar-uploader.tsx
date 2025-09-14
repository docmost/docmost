import React, { useRef } from "react";
import { Menu, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IconTrash, IconUpload } from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { getAvatarUrl } from "@/lib/config.ts";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { notifications } from "@mantine/notifications";

interface AvatarUploaderProps {
  currentImageUrl?: string | null;
  fallbackName?: string;
  size?: string | number;
  type: AvatarIconType;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function AvatarUploader({
  currentImageUrl,
  fallbackName,
  size,
  type,
  onUpload,
  onRemove,
  isLoading = false,
  disabled = false,
}: AvatarUploaderProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || disabled) {
      return;
    }

    try {
      await onUpload(file);
      notifications.show({
        message: t("Image uploaded successfully"),
      });
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || t("Failed to upload image");
      notifications.show({
        message: errorMessage,
        color: "red",
      });
    }

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input ref is null!");
    }
  };

  const handleRemove = async () => {
    if (disabled) return;

    try {
      await onRemove();
      notifications.show({
        message: t("Image removed successfully"),
      });
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || t("Failed to remove image");
      notifications.show({
        message: errorMessage,
        color: "red",
      });
    }
  };

  return (
    <Box>
      {/* Hidden file input - outside of Menu to prevent unmounting issues */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/jpg"
        style={{ display: "none" }}
      />

      <Menu shadow="md" width={200} withArrow disabled={disabled}>
        <Menu.Target>
          <CustomAvatar
            component="button"
            size={size}
            avatarUrl={getAvatarUrl(currentImageUrl, type)}
            name={fallbackName}
            style={{ cursor: disabled ? "default" : "pointer" }}
          />
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconUpload size={16} />}
            disabled={isLoading || disabled}
            onClick={handleUploadClick}
          >
            {t("Upload image")}
          </Menu.Item>

          {currentImageUrl && (
            <Menu.Item
              leftSection={<IconTrash size={16} />}
              color="red"
              onClick={handleRemove}
              disabled={isLoading || disabled}
            >
              {t("Remove image")}
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    </Box>
  );
}
