import { BadRequestException } from '@nestjs/common';
import { Workspace } from '@docmost/db/types/entity.types';
import { createHmac } from 'node:crypto';

export function computeEmailSignature(
  email: string,
  workspaceId: string,
  appSecret: string,
): string {
  return createHmac('sha256', appSecret)
    .update(`${email.toLowerCase()}:${workspaceId}`)
    .digest('hex');
}

export function throwIfEmailNotVerified(opts: {
  isCloud: boolean;
  emailVerifiedAt: Date | null;
  email: string;
  workspaceId: string;
  appSecret: string;
}): void {
  if (!opts.isCloud || opts.emailVerifiedAt) return;

  const emailSignature = computeEmailSignature(
    opts.email,
    opts.workspaceId,
    opts.appSecret,
  );
  throw new BadRequestException({
    message:
      'Please verify your email address. Check your inbox for the verification link.',
    emailSignature,
  });
}

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
