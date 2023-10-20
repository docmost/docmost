import { Modal, Text } from '@mantine/core';
import React from 'react';
import SettingsSidebar from '@/features/settings/modal/settings-sidebar';
import { useAtom } from 'jotai';
import { settingsModalAtom } from '@/features/settings/modal/atoms/settings-modal-atom';

export default function SettingsModal() {
  const [isModalOpen, setModalOpen] = useAtom(settingsModalAtom);

  return (
    <>
      <Modal.Root size={1000} opened={isModalOpen} onClose={() => setModalOpen(false)}>
        <Modal.Overlay />
        <Modal.Content>
          <Modal.Header>
            <Modal.Title>
              <Text size="xl" fw={500}>Settings</Text>
            </Modal.Title>
            <Modal.CloseButton />
          </Modal.Header>
          <Modal.Body>

            <SettingsSidebar />

          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
