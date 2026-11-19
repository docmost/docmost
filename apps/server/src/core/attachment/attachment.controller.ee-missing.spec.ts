import { NotFoundException } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';

jest.mock(
  '../../ee/template/services/template-access.service',
  () => {
    throw new Error('not bundled');
  },
  { virtual: true },
);

describe('AttachmentController without the EE template module', () => {
  it('answers 404 for template uploads', async () => {
    const moduleRef = { get: jest.fn() };
    const controller = new (AttachmentController as any)(
      ...Array(13).fill({}),
      moduleRef,
    );

    await expect(
      controller.findEditableTemplate(
        'template-id',
        { id: 'user-id' },
        { id: 'workspace-id' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(moduleRef.get).not.toHaveBeenCalled();
  });
});
