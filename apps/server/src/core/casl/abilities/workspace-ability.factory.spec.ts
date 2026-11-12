import WorkspaceAbilityFactory from './workspace-ability.factory';
import { UserRole } from '../../../common/helpers/types/permission';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../interfaces/workspace-ability.type';

describe('WorkspaceAbilityFactory', () => {
  const factory = new WorkspaceAbilityFactory();
  const abilityFor = (role: UserRole) =>
    factory.createForUser({ role } as any, {} as any);

  it('lets owners manage legal holds', () => {
    expect(
      abilityFor(UserRole.OWNER).can(
        WorkspaceCaslAction.Manage,
        WorkspaceCaslSubject.LegalHold,
      ),
    ).toBe(true);
  });

  it.each([UserRole.ADMIN, UserRole.MEMBER])(
    'gives %s no access to legal holds',
    (role) => {
      const ability = abilityFor(role);
      for (const action of Object.values(WorkspaceCaslAction)) {
        expect(ability.can(action, WorkspaceCaslSubject.LegalHold)).toBe(false);
      }
    },
  );
});
