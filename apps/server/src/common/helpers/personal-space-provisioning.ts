import { ModuleRef } from '@nestjs/core';

export async function provisionPersonalSpaceForNewUser(
  moduleRef: ModuleRef,
  userId: string,
  workspaceId: string,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const personalSpaceModule = require('../../ee/personal-space/services/personal-space.service');
    const personalSpaceService = moduleRef.get(
      personalSpaceModule.PersonalSpaceService,
      { strict: false },
    );
    await personalSpaceService.provisionForNewUser(userId, workspaceId);
  } catch {
    // module not found
  }
}
