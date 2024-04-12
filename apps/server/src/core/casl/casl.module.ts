import { Global, Module } from '@nestjs/common';
import CaslAbilityFactory from './abilities/casl-ability.factory';
import SpaceAbilityFactory from './abilities/space-ability.factory';

@Global()
@Module({
  providers: [CaslAbilityFactory, SpaceAbilityFactory],
  exports: [CaslAbilityFactory, SpaceAbilityFactory],
})
export class CaslModule {}
