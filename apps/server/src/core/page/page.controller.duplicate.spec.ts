import { Feature } from '../../common/features';
import { JwtType } from '../auth/dto/jwt-payload';
import { PageController } from './page.controller';

describe('PageController.duplicatePage', () => {
  it.each([
    ['licensed session', JwtType.ACCESS, true, undefined, true],
    ['licensed cross-space copy', JwtType.ACCESS, true, 'target-space', true],
    ['unlicensed session', JwtType.ACCESS, false, undefined, false],
    ['cloud session', JwtType.ACCESS, false, 'target-space', false],
    ['API key', JwtType.API_KEY, true, undefined, false],
    ['OAuth token', JwtType.OAUTH_ACCESS, true, 'target-space', false],
  ] as const)(
    'duplicates for a %s',
    async (_name, authType, entitled, spaceId, copyPageProperties) => {
      const page = {
        id: 'source',
        spaceId: 'source-space',
        workspaceId: 'workspace',
      };
      const user = { id: 'user', workspaceId: page.workspaceId } as any;
      const workspace = {
        id: page.workspaceId,
        licenseKey: 'license',
        plan: 'business',
      } as any;
      const copy = { id: 'copy', childPageIds: [] };
      const pages = { duplicatePage: jest.fn().mockResolvedValue(copy) };
      const license = { hasFeature: jest.fn().mockReturnValue(entitled) };
      const controller = new PageController(
        pages as any,
        { findById: () => page } as any,
        undefined,
        { createForUser: () => ({ cannot: () => false }) } as any,
        { validateCanView: () => {} } as any,
        undefined,
        undefined,
        { log: () => {} } as any,
        license as any,
      );

      const result = await controller.duplicatePage(
        { pageId: page.id, spaceId },
        user,
        workspace,
        { user: { authType } },
      );

      expect(result).toBe(copy);
      expect(pages.duplicatePage).toHaveBeenCalledWith(page, spaceId, user, {
        copyPageProperties,
      });
      if (authType === JwtType.ACCESS) {
        expect(license.hasFeature).toHaveBeenCalledWith(
          workspace.licenseKey,
          Feature.PAGE_PROPERTIES,
          workspace.plan,
        );
      } else {
        expect(license.hasFeature).not.toHaveBeenCalled();
      }
    },
  );
});
