import { Modal, ScrollArea, rem } from "@mantine/core";
import React, { useMemo } from "react";
import { useSpaceQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import RecycledPagesList from "@/features/space/components/recycled-pages.tsx"

interface RecycleBinModalProps {
    spaceId: string;
    opened: boolean;
    onClose: () => void;
}

export default function RecycleBinModal({
    spaceId,
    opened,
    onClose,
}: RecycleBinModalProps) {
    const { data: space, isLoading } = useSpaceQuery(spaceId);

    const spaceRules = space?.membership?.permissions;
    const spaceAbility = useMemo(() => useSpaceAbility(spaceRules), [spaceRules]);

    return (
        <>
            <Modal.Root
                opened={opened}
                onClose={onClose}
                size={600}
                padding="xl"
                yOffset="10vh"
                xOffset={0}
                mah={400}
            >
                <Modal.Overlay />
                <Modal.Content style={{ overflow: "hidden" }}>
                    <Modal.Header py={0}>
                        <Modal.Title fw={500}>{space?.name}</Modal.Title>
                        <Modal.CloseButton />
                    </Modal.Header>
                    <Modal.Body>
                        <div style={{ height: rem("600px") }}>
                            <ScrollArea h="600" w="100%" scrollbarSize={5}>
                                <RecycledPagesList spaceId={space.id} />
                            </ScrollArea>
                        </div>
                    </Modal.Body>
                </Modal.Content>
            </Modal.Root>   
        </>
    )    
}