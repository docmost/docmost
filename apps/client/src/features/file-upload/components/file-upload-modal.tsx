import { useState } from "react";
import { Modal, FileInput, Button, Text, Group, Loader } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IconPaperclip, IconUpload } from "@tabler/icons-react";
import classes from "./file-upload-modal.module.css";

interface FileUploadModalProps {
  spaceId?: string;
  opened: boolean;
  onClose: () => void;
}
export function FileUploadModal({
  spaceId,
  opened,
  onClose,
}: FileUploadModalProps) {
  const { t } = useTranslation();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string>(" ");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleClose = () => {
    setFile(null);
    setUploading(false);
    setUploadSuccess(" ");
    setUploadError(null);
    onClose();
  };

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setUploading(false);
    setUploadSuccess(" ");
    setUploadError(null);
  };

  const handleUpload = (filename: string) => {
    if (!file) return;

    setUploading(true);
    setUploadSuccess(" ");
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("spaceId", spaceId);

    fetch("/api/pdf2pages/convert", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        setFile(null);
        setUploadSuccess(`Uploaded: ${filename} Successfully`);
        setUploading(false);
      })
      .catch((err) => {
        console.error("Upload failed", err);
        setUploadError(`Upload ${filename} failed`);
        setUploading(false);
        setFile(null);
      });
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title={<strong>Upload a PDF to convert it to a Page</strong>}
        centered
      >
        <Group justify="center" mt="md" style={{ minHeight: 100 }}>
          <FileInput
            label=""
            placeholder="Choose file"
            value={file}
            onChange={handleFileChange}
            accept="application/pdf"
            classNames={{ input: classes.customFileInput }}
            leftSection={<IconPaperclip size={18} />}
          />

          <Button
            onClick={() => handleUpload(file.name)}
            disabled={!file}
            rightSection={<IconUpload size="1rem" />}
          >
            {/* <IconUpload size={16} /> */}
            <span>{t("Upload")}</span>
          </Button>
        </Group>
        <Group justify="center" mt="md">
          {/* <Divider my="sm" /> */}
          <br></br>
          <Text color="green" mt="md">
            {uploadSuccess}
          </Text>
          {uploading && <Loader />}

          {uploadError && (
            <Text color="red" mt="md">
              {uploadError}
            </Text>
          )}
        </Group>
      </Modal>
    </>
  );
}
