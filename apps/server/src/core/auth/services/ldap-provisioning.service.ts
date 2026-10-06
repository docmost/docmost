import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';
import { isUserDisabled } from '../../../common/helpers';
import { LdapIdentityRepo } from '../../../database/repos/ldap-identity/ldap-identity.repo';
import { UserRepo } from '../../../database/repos/user/user.repo';
import { LdapAuthenticatedIdentity } from './ldap-auth.service';
import { SignupService } from './signup.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';

@Injectable()
export class LdapProvisioningService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly ldapIdentityRepo: LdapIdentityRepo,
    private readonly userRepo: UserRepo,
    private readonly signupService: SignupService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async findOrProvisionMember(
    identity: LdapAuthenticatedIdentity,
    workspaceId: string,
  ): Promise<User> {
    const result = await executeTx(this.db, async (trx) => {
      await this.ldapIdentityRepo.lockForProvisioning(
        workspaceId,
        identity.subjectId,
        identity.email,
        trx,
      );

      const existingIdentity = await this.ldapIdentityRepo.findBySubjectId(
        workspaceId,
        identity.subjectId,
        trx,
      );
      if (existingIdentity) {
        const user = await this.userRepo.findById(
          existingIdentity.userId,
          workspaceId,
          { trx },
        );
        if (!user || isUserDisabled(user)) {
          throw new UnauthorizedException('LDAP account is unavailable');
        }
        return { user, created: false };
      }

      const user = await this.signupService.signupLdapUser(
        identity,
        workspaceId,
        trx,
      );
      await this.ldapIdentityRepo.insertIdentity(
        {
          workspaceId,
          userId: user.id,
          subjectId: identity.subjectId,
        },
        trx,
      );
      return { user, created: true };
    });

    if (result.created) {
      this.auditService.log({
        event: AuditEvent.USER_CREATED,
        resourceType: AuditResource.USER,
        resourceId: result.user.id,
        changes: {
          after: {
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
          },
        },
        metadata: { source: 'ldap' },
      });
    }

    return result.user;
  }
}