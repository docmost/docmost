import { Global, Module } from '@nestjs/common';
import SpaceAbilityFactory from './abilities/space-ability.factory';
import WorkspaceAbilityFactory from './abilities/workspace-ability.factory';
import PageAbilityFactory from './abilities/page-ability.factory';

@Global()
@Module({
  providers: [WorkspaceAbilityFactory, SpaceAbilityFactory, PageAbilityFactory],
  exports: [WorkspaceAbilityFactory, SpaceAbilityFactory, PageAbilityFactory],
})
export class CaslModule {}
