import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private licenseCheckService: LicenseCheckService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.get<string>(
      REQUIRED_FEATURE_KEY,
      context.getHandler(),
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const workspace = request.user?.workspace;

    if (!workspace) {
      throw new ForbiddenException('Workspace not found');
    }

    const canAccess = this.licenseCheckService.hasFeature(
      workspace.licenseKey ?? '',
      requiredFeature,
      workspace.plan,
    );

    if (!canAccess) {
      throw new ForbiddenException(
        `Feature '${requiredFeature}' is not available in your plan`,
      );
    }

    return true;
  }
}
