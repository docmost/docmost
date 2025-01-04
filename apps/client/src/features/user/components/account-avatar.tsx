import { focusAtom } from "jotai-optics";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useAtom } from "jotai";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { FileButton, Tooltip } from "@mantine/core";
import { uploadAvatar } from "@/features/user/services/user-service.ts";
import { useTranslation } from "react-i18next";

const userAtom = focusAtom(currentUserAtom, (optic) => optic.prop("user"));

export default function AccountAvatar() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    try {
      setIsLoading(true);
      const avatar = await uploadAvatar(selectedFile);

      setUser((prev) => ({ ...prev, avatarUrl: avatar.fileName }));
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <FileButton onChange={handleFileChange} accept="image/png,image/jpeg">
        {(props) => (
          <Tooltip label={t("Change photo")} position="bottom">
            <CustomAvatar
              {...props}
              component="button"
              size="60px"
              avatarUrl={currentUser?.user.avatarUrl}
              name={currentUser?.user.name}
              style={{ cursor: "pointer" }}
            />
          </Tooltip>
        )}
      </FileButton>
    </>
  );
}
