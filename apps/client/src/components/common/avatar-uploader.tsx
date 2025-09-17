import React, { useRef } from "react";
import { Menu, Box, Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IconTrash, IconUpload } from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { notifications } from "@mantine/notifications";

interface AvatarUploaderProps {
  currentImageUrl?: string | null;
  fallbackName?: string;
  radius?: string | number;
  size?: string | number;
  variant?: string;
  type: AvatarIconType;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function AvatarUploader({
  currentImageUrl,
  fallbackName,
  radius,
  variant,
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

    // Validate file size (max 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      notifications.show({
        message: t("Image exceeds 10MB limit."),
        color: "red",
      });
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    try {
      await onUpload(file);
    } catch (error) {
      console.error(error);
      notifications.show({
        message: t("Failed to upload image"),
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
      console.error(error);
      notifications.show({
        message: t("Failed to remove image"),
        color: "red",
      });
    }
  };

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/jpg"
        style={{ display: "none" }}
      />

      <Menu shadow="md" width={200} withArrow disabled={disabled || isLoading}>
        <Menu.Target>
          <Box style={{ position: "relative", display: "inline-block" }}>
            <CustomAvatar
              component="button"
              size={size}
              avatarUrl={currentImageUrl}
              name={fallbackName}
              style={{
                cursor: disabled || isLoading ? "default" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
              radius={radius}
              variant={variant}
              type={type}
            />
            {isLoading && (
              <Box
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 1000,
                }}
              >
                <Loader size="sm" />
              </Box>
            )}
          </Box>
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
