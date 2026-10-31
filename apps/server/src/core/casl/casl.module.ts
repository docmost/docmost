import { Global, Module } from '@nestjs/common';
import SpaceAbilityFactory from './abilities/space-ability.factory.js';
import WorkspaceAbilityFactory from './abilities/workspace-ability.factory.js';

@Global()
@Module({
  providers: [WorkspaceAbilityFactory, SpaceAbilityFactory],
  exports: [WorkspaceAbilityFactory, SpaceAbilityFactory],
})
export class CaslModule {}
