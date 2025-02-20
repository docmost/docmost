import { SpaceSelect } from "@/features/space/components/sidebar/space-select";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { Modal, Text } from "@mantine/core";
import { useParams } from "react-router-dom";
import { ISpace } from "@/features/space/types/space.types";

interface SpaceSelectionModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSelect: (space: ISpace) => void;
}

export function SpaceSelectionModal({ open, title, onClose, onSelect }: SpaceSelectionModalProps) {
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

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
            label={space.name}
            value={space.slug}
            onChange={onSelect}
          />
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  )
}