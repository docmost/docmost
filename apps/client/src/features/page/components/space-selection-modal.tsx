import { SpaceSelect } from "@/features/space/components/sidebar/space-select";
import { Modal, Text } from "@mantine/core";
import { ISpace } from "@/features/space/types/space.types";

interface SpaceSelectionModalProps {
  open: boolean;
  title: string;
  currentSpace: ISpace;
  onClose: () => void;
  onSelect: (space: ISpace) => void;
}

export function SpaceSelectionModal({ open, title, onClose, onSelect, currentSpace }: SpaceSelectionModalProps) {
  return (
    <Modal.Root
      size={350}
      opened={open}
      onClose={onClose}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "visible" }}>
        <Modal.Header>
          <Modal.Title>
            <Text size="md" fw={500}>
              {title}
            </Text>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <SpaceSelect
            label={currentSpace.name}
            value={currentSpace.slug}
            onChange={onSelect}
          />
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  )
}