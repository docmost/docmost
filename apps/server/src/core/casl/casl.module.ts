import { Global, Module } from '@nestjs/common';
import SpaceAbilityFactory from './abilities/space-ability.factory';
import WorkspaceAbilityFactory from './abilities/workspace-ability.factory';

@Global()
@Module({
  providers: [WorkspaceAbilityFactory, SpaceAbilityFactory],
  exports: [WorkspaceAbilityFactory, SpaceAbilityFactory],
})
export class CaslModule {}
