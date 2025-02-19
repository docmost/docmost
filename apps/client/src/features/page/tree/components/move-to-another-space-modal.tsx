import { SpaceSelect } from "@/features/space/components/sidebar/space-select";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { Modal, Text } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { movePageToAnotherSpace } from "../../services/page-service";
import { getSpaceUrl } from "@/lib/config";
import { t } from "i18next";
import { ISpace } from "@/features/space/types/space.types";
import { queryClient } from "@/main";

interface MoveToAnotherSpaceModalProps {
  open: boolean;
  onClose: () => void;
  pageId: string
}

export function MoveToAnotherSpaceModal({ open, onClose, pageId }: MoveToAnotherSpaceModalProps) {
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const navigate = useNavigate();

  async function doMove(space: ISpace) {
    onClose();
    await movePageToAnotherSpace({ pageId, spaceId: space.id });
    queryClient.removeQueries({ predicate: item => item.queryKey[0] === 'pages' })
    await navigate(getSpaceUrl(space.slug));
  }

  return (
    <Modal.Root
      size={350}
      opened={open}
      onClose={() => onClose()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header>
          <Modal.Title>
            <Text size="md" fw={500}>
              {t("Move page to another space")}
            </Text>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
          <SpaceSelect
            label={space.name}
            value={space.slug}
            сomboboxProps={{ width: 300, withinPortal: true }}
            onChange={doMove}
          />
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  )
}