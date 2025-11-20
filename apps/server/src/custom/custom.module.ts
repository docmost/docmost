import { Module, DynamicModule } from '@nestjs/common';
import { OidcModule } from './oidc/oidc.module';

@Module({})
export class CustomModule {
  static forRoot(): DynamicModule {
    const modules = [];

    // 根据环境变量决定是否加载 OIDC 模块
    if (process.env.CUSTOM_OIDC_ENABLED !== 'false') {
      modules.push(OidcModule);
    }

    return {
      module: CustomModule,
      imports: modules,
    };
  }
}
