import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { JwtPayload, JwtType } from '../dto/jwt-payload';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../../user/repositories/user.repository';
import { UserService } from '../../user/user.service';
import { WorkspaceRepository } from '../../workspace/repositories/workspace.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private userRepository: UserRepository,
    private workspaceRepository: WorkspaceRepository,
    private readonly environmentService: EnvironmentService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: environmentService.getJwtSecret(),
      passReqToCallback: true,
    });
  }

  async validate(req, payload: JwtPayload) {
    // CLOUD ENV
    if (this.environmentService.isCloud()) {
      if (req.raw.workspaceId && req.raw.workspaceId !== payload.workspaceId) {
        throw new BadRequestException('Workspace does not match');
      }
    }

    if (!payload.workspaceId || payload.type !== JwtType.ACCESS) {
      throw new UnauthorizedException();
    }

    const workspace = await this.workspaceRepository.findById(
      payload.workspaceId,
    );

    if (!workspace) {
      throw new UnauthorizedException();
    }
    const user = await this.userRepository.findOne({
      where: {
        id: payload.sub,
        workspaceId: payload.workspaceId,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return { user, workspace };
  }
}
