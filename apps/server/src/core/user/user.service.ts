import { UserRepo } from '@docmost/db/repos/user/user.repo';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { comparePasswordHash } from 'src/common/helpers/utils';
import { Workspace } from '@docmost/db/types/entity.types';
import { validateSsoEnforcement } from '../auth/auth.util';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepo,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async findById(userId: string, workspaceId: string) {
    return this.userRepo.findById(userId, workspaceId);
  }

  async update(
    updateUserDto: UpdateUserDto,
    userId: string,
    workspace: Workspace,
  ) {
    const includePassword =
      updateUserDto.email != null && updateUserDto.confirmPassword != null;

    const user = await this.userRepo.findById(userId, workspace.id, {
      includePassword,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // preference update
    if (typeof updateUserDto.fullPageWidth !== 'undefined') {
      const result = await this.userRepo.updatePreference(
        userId,
        'fullPageWidth',
        updateUserDto.fullPageWidth,
      );

      this.auditService.log({
        event: AuditEvent.USER_UPDATED,
        resourceType: AuditResource.USER,
        resourceId: userId,
        changes: {
          after: { fullPageWidth: updateUserDto.fullPageWidth },
        },
      });

      return result;
    }

    if (typeof updateUserDto.pageEditMode !== 'undefined') {
      const result = await this.userRepo.updatePreference(
        userId,
        'pageEditMode',
        updateUserDto.pageEditMode.toLowerCase(),
      );

      this.auditService.log({
        event: AuditEvent.USER_UPDATED,
        resourceType: AuditResource.USER,
        resourceId: userId,
        changes: {
          after: { pageEditMode: updateUserDto.pageEditMode.toLowerCase() },
        },
      });

      return result;
    }

    const originalName = user.name;
    const originalEmail = user.email;
    const originalLocale = user.locale;

    if (updateUserDto.name) {
      user.name = updateUserDto.name;
    }

    if (updateUserDto.email && user.email != updateUserDto.email) {
      validateSsoEnforcement(workspace);

      if (!updateUserDto.confirmPassword) {
        throw new BadRequestException(
          'You must provide a password to change your email',
        );
      }

      const isPasswordMatch = await comparePasswordHash(
        updateUserDto.confirmPassword,
        user.password,
      );

      if (!isPasswordMatch) {
        throw new BadRequestException('You must provide the correct password to change your email');
      }

      if (await this.userRepo.findByEmail(updateUserDto.email, workspace.id)) {
        throw new BadRequestException('A user with this email already exists');
      }

      user.email = updateUserDto.email;
    }

    if (updateUserDto.avatarUrl) {
      user.avatarUrl = updateUserDto.avatarUrl;
    }

    if (updateUserDto.locale) {
      user.locale = updateUserDto.locale;
    }

    delete updateUserDto.confirmPassword;

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    if (updateUserDto.name && updateUserDto.name !== originalName) {
      before.name = originalName;
      after.name = updateUserDto.name;
    }
    if (updateUserDto.email && updateUserDto.email !== originalEmail) {
      before.email = originalEmail;
      after.email = updateUserDto.email;
    }
    if (updateUserDto.locale && updateUserDto.locale !== originalLocale) {
      before.locale = originalLocale;
      after.locale = updateUserDto.locale;
    }

    await this.userRepo.updateUser(updateUserDto, userId, workspace.id);

    if (Object.keys(after).length > 0) {
      this.auditService.log({
        event: AuditEvent.USER_UPDATED,
        resourceType: AuditResource.USER,
        resourceId: userId,
        changes: { before, after },
      });
    }

    return user;
  }
}
