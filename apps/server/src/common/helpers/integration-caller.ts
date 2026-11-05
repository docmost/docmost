import { ClsService } from 'nestjs-cls';

export const INTEGRATION_CALLER_KEY = 'integrationCaller';

export const ARCHIVED_SPACE_LOOKUPS_KEY = 'archivedSpaceLookups';

export function markIntegrationCaller(cls: ClsService): void {
  if (!cls.isActive()) {
    throw new Error('Cannot mark an integration caller outside a CLS context');
  }
  cls.set(INTEGRATION_CALLER_KEY, true);
}

export function isIntegrationCaller(cls: ClsService): boolean {
  return cls.isActive() && cls.get(INTEGRATION_CALLER_KEY) === true;
}
