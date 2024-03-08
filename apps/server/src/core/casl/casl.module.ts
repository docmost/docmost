import { Global, Module } from '@nestjs/common';
import CaslAbilityFactory from './abilities/casl-ability.factory';

@Global()
@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
