import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcceptInviteDto, InviteUserDto } from '../dto/invitation.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  Group,
  User,
  Workspace,
  WorkspaceInvitation,
} from '@docmost/db/types/entity.types';
import { MailService } from '../../../integrations/mail/mail.service';
import InvitationEmail from '@docmost/transactional/emails/invitation-email';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import InvitationAcceptedEmail from '@docmost/transactional/emails/invitation-accepted-email';
import { TokenService } from '../../auth/services/token.service';
import { nanoIdGen } from '../../../common/helpers';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { DomainService } from 'src/integrations/environment/domain.service';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { Queue } from 'bullmq';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class WorkspaceInvitationService {
  private readonly logger = new Logger(WorkspaceInvitationService.name);
  constructor(
    private userRepo: UserRepo,
    private groupUserRepo: GroupUserRepo,
    private mailService: MailService,
    private domainService: DomainService,
    private tokenService: TokenService,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.BILLING_QUEUE) private billingQueue: Queue,
    private readonly environmentService: EnvironmentService,
  ) {}

  async getInvitations(workspaceId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('workspaceInvitations')
      .select(['id', 'email', 'role', 'workspaceId', 'createdAt'])
      .where('workspaceId', '=', workspaceId);

    if (pagination.query) {
      query = query.where((eb) =>
        eb('email', 'ilike', `%${pagination.query}%`),
      );
    }

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async getInvitationById(invitationId: string, workspaceId: string) {
    const invitation = await this.db
      .selectFrom('workspaceInvitations')
      .select(['id', 'email', 'createdAt'])
      .where('id', '=', invitationId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  async getInvitationTokenById(invitationId: string, workspaceId: string) {
    const invitation = await this.db
      .selectFrom('workspaceInvitations')
      .select(['token'])
      .where('id', '=', invitationId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }

  async createInvitation(
    inviteUserDto: InviteUserDto,
    workspace: Workspace,
    authUser: User,
  ): Promise<void> {
    const { emails, role, groupIds } = inviteUserDto;

    let invites: WorkspaceInvitation[] = [];

    try {
      await executeTx(this.db, async (trx) => {
        // we do not want to invite existing members
        const findExistingUsers = await this.db
          .selectFrom('users')
          .select(['email'])
          .where('users.email', 'in', emails)
          .where('users.workspaceId', '=', workspace.id)
          .execute();

        let existingUserEmails = [];
        if (findExistingUsers) {
          existingUserEmails = findExistingUsers.map((user) => user.email);
        }

        // filter out existing users
        const inviteEmails = emails.filter(
          (email) => !existingUserEmails.includes(email),
        );

        let validGroups = [];
        if (groupIds && groupIds.length > 0) {
          validGroups = await trx
            .selectFrom('groups')
            .select(['id', 'name'])
            .where('groups.id', 'in', groupIds)
            .where('groups.workspaceId', '=', workspace.id)
            .execute();
        }

        const invitesToInsert = inviteEmails.map((email) => ({
          email: email,
          role: role,
          token: nanoIdGen(16),
          workspaceId: workspace.id,
          invitedById: authUser.id,
          groupIds: validGroups?.map((group: Partial<Group>) => group.id),
        }));

        invites = await trx
          .insertInto('workspaceInvitations')
          .values(invitesToInsert)
          .onConflict((oc) => oc.columns(['email', 'workspaceId']).doNothing())
          .returningAll()
          .execute();
      });
    } catch (err) {
      this.logger.error(`createInvitation - ${err}`);
      throw new BadRequestException(
        'An error occurred while processing the invitations.',
      );
    }

    // do not send code to do nothing users
    if (invites) {
      invites.forEach((invitation: WorkspaceInvitation) => {
        this.sendInvitationMail(
          invitation.id,
          invitation.email,
          invitation.token,
          authUser.name,
          workspace.hostname,
        );
      });
    }
  }

  async acceptInvitation(dto: AcceptInviteDto, workspaceId: string) {
    const invitation = await this.db
      .selectFrom('workspaceInvitations')
      .selectAll()
      .where('id', '=', dto.invitationId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!invitation) {
      throw new BadRequestException('Invitation not found');
    }

    if (dto.token !== invitation.token) {
      throw new BadRequestException('Invalid invitation token');
    }

    let newUser: User;

    try {
      await executeTx(this.db, async (trx) => {
        newUser = await this.userRepo.insertUser(
          {
            name: dto.name,
            email: invitation.email,
            emailVerifiedAt: new Date(),
            password: dto.password,
            role: invitation.role,
            invitedById: invitation.invitedById,
            workspaceId: workspaceId,
          },
          trx,
        );

        // add user to default group
        await this.groupUserRepo.addUserToDefaultGroup(
          newUser.id,
          workspaceId,
          trx,
        );

        if (invitation.groupIds && invitation.groupIds.length > 0) {
          // Ensure the groups are valid
          const validGroups = await trx
            .selectFrom('groups')
            .select(['id', 'name'])
            .where('groups.id', 'in', invitation.groupIds)
            .where('groups.workspaceId', '=', workspaceId)
            .execute();

          if (validGroups && validGroups.length > 0) {
            const groupUsersToInsert = validGroups.map((group) => ({
              userId: newUser.id,
              groupId: group.id,
            }));

            // add user to groups specified during invite
            await trx
              .insertInto('groupUsers')
              .values(groupUsersToInsert)
              .onConflict((oc) => oc.columns(['userId', 'groupId']).doNothing())
              .execute();
          }
        }

        // delete invitation record
        await trx
          .deleteFrom('workspaceInvitations')
          .where('id', '=', invitation.id)
          .execute();
      });
    } catch (err: any) {
      this.logger.error(`acceptInvitation - ${err}`);
      if (err.message.includes('unique constraint')) {
        throw new BadRequestException('Invitation already accepted');
      }
      throw new BadRequestException(
        'Failed to accept invitation. An error occurred.',
      );
    }

    if (!newUser) {
      return;
    }

    // notify the inviter
    const invitedByUser = await this.userRepo.findById(
      invitation.invitedById,
      workspaceId,
    );

    if (invitedByUser) {
      const emailTemplate = InvitationAcceptedEmail({
        invitedUserName: newUser.name,
        invitedUserEmail: newUser.email,
      });

      await this.mailService.sendToQueue({
        to: invitedByUser.email,
        subject: `${newUser.name} has accepted your Docmost invite`,
        template: emailTemplate,
      });
    }

    if (this.environmentService.isCloud()) {
      await this.billingQueue.add(QueueJob.STRIPE_SEATS_SYNC, { workspaceId });
    }

    return this.tokenService.generateAccessToken(newUser);
  }

  async resendInvitation(
    invitationId: string,
    workspace: Workspace,
  ): Promise<void> {
    const invitation = await this.db
      .selectFrom('workspaceInvitations')
      .selectAll()
      .where('id', '=', invitationId)
      .where('workspaceId', '=', workspace.id)
      .executeTakeFirst();

    if (!invitation) {
      throw new BadRequestException('Invitation not found');
    }

    const invitedByUser = await this.userRepo.findById(
      invitation.invitedById,
      workspace.id,
    );

    await this.sendInvitationMail(
      invitation.id,
      invitation.email,
      invitation.token,
      invitedByUser.name,
      workspace.hostname,
    );
  }

  async revokeInvitation(
    invitationId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .deleteFrom('workspaceInvitations')
      .where('id', '=', invitationId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async getInvitationLinkById(
    invitationId: string,
    workspace: Workspace,
  ): Promise<string> {
    const token = await this.getInvitationTokenById(invitationId, workspace.id);
    return this.buildInviteLink({
      invitationId,
      inviteToken: token.token,
      hostname: workspace.hostname,
    });
  }

  async buildInviteLink(opts: {
    invitationId: string;
    inviteToken: string;
    hostname?: string;
  }): Promise<string> {
    const { invitationId, inviteToken, hostname } = opts;
    return `${this.domainService.getUrl(hostname)}/invites/${invitationId}?token=${inviteToken}`;
  }

  async sendInvitationMail(
    invitationId: string,
    inviteeEmail: string,
    inviteToken: string,
    invitedByName: string,
    hostname?: string,
  ): Promise<void> {
    const inviteLink = await this.buildInviteLink({
      invitationId,
      inviteToken,
      hostname,
    });

    const emailTemplate = InvitationEmail({
      inviteLink,
    });

    await this.mailService.sendToQueue({
      to: inviteeEmail,
      subject: `${invitedByName} invited you to Docmost`,
      template: emailTemplate,
    });
  }
}
