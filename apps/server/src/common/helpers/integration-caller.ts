import { ClsService } from 'nestjs-cls';

export const INTEGRATION_CALLER_KEY = 'integrationCaller';

export function markIntegrationCaller(cls: ClsService): void {
  if (cls.isActive()) {
    cls.set(INTEGRATION_CALLER_KEY, true);
  }
}

export function isIntegrationCaller(cls: ClsService): boolean {
  return cls.isActive() && cls.get(INTEGRATION_CALLER_KEY) === true;
}
