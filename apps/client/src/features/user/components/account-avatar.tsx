import { focusAtom } from "jotai-optics";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useAtom } from "jotai";
import { UserAvatar } from "@/components/ui/user-avatar.tsx";
import { FileButton, Tooltip } from "@mantine/core";
import { uploadAvatar } from "@/features/user/services/user-service.ts";

const userAtom = focusAtom(currentUserAtom, (optic) => optic.prop("user"));

export default function AccountAvatar() {
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

  console.log(currentUser?.user.avatarUrl);

  return (
    <>
      <FileButton onChange={handleFileChange} accept="image/png,image/jpeg">
        {(props) => (
          <Tooltip label="Change photo" position="bottom">
            <UserAvatar
              {...props}
              component="button"
              radius="xl"
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
