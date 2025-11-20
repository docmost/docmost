import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OidcController } from './oidc.controller';
import { OidcService } from './services/oidc.service';
import { OidcStrategy } from './strategies/oidc.strategy';
import { TokenModule } from '../../core/auth/token.module';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { EnvironmentModule } from '../../integrations/environment/environment.module';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'oidc' }),
        TokenModule,
        EnvironmentModule,
    ],
    controllers: [OidcController],
    providers: [
        OidcService,
        OidcStrategy,
        UserRepo,
    ],
    exports: [OidcService],
})
export class OidcModule { }
