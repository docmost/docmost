import {
  Modal,
  Button,
  SimpleGrid,
  FileButton,
} from '@mantine/core';
import { IconFileCode, IconMarkdown } from '@tabler/icons-react';
import { useState } from 'react';

interface PageImportModalProps {
  spaceId: string;
  open: boolean;
  onClose: () => void;
}

export default function PageImportModal({
  spaceId,
  open,
  onClose,
}: PageImportModalProps) {
  return (
    <>
      <Modal opened={open} onClose={onClose} size="500" title="Import page">
        <ExportFormatSelection />
      </Modal>
    </>
  );
}

function ExportFormatSelection() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <>
      <SimpleGrid cols={2}>
        <FileButton onChange={setFiles} accept="image/png,image/jpeg" multiple>
          {(props) => (
            <Button
              justify="start"
              variant="default"
              leftSection={<IconMarkdown size={18} />}
              {...props}
            >
              Markdown
            </Button>
          )}
        </FileButton>

        <FileButton onChange={setFiles} accept="image/png,image/jpeg" multiple>
          {(props) => (
            <Button
              justify="start"
              variant="default"
              leftSection={<IconFileCode size={18} />}
              {...props}
            >
              HTML
            </Button>
          )}
        </FileButton>
      </SimpleGrid>
    </>
  );
}
