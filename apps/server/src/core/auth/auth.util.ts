import { BadRequestException } from '@nestjs/common';
import { Workspace } from '@docmost/db/types/entity.types';

export function validateSsoEnforcement(workspace: Workspace) {
  if (workspace.enforceSso) {
    throw new BadRequestException('This workspace has enforced SSO login.');
  }
}

export function validateAllowedEmail(userEmail: string, workspace: Workspace) {
  const emailParts = userEmail.split('@');
  const emailDomain = emailParts[1].toLowerCase();
  if (
    workspace.emailDomains?.length > 0 &&
    !workspace.emailDomains.includes(emailDomain)
  ) {
    throw new BadRequestException(
      `The email domain "${emailDomain}" is not approved for this workspace.`,
    );
  }
}
