import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { JwtType } from '../dto/jwt-payload';

const USER = { id: 'user_1', deactivatedAt: null, deletedAt: null } as any;

function createService() {
  const jwtService = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: '90d', issuer: 'Docmost' },
  });

  return { service: new TokenService(jwtService, {} as any), jwtService };
}

describe('TokenService.generateApiToken', () => {
  it('signs the token with the lifetime of the key', async () => {
    const { service, jwtService } = createService();

    const token = await service.generateApiToken({
      apiKeyId: 'key_1',
      user: USER,
      workspaceId: 'ws_1',
      expiresIn: 3600,
    });

    const { type, iat, exp } = jwtService.decode(token);
    expect(type).toBe(JwtType.API_KEY);
    expect(exp - iat).toBe(3600);
  });

  it('refuses to sign without a lifetime instead of using the session one', async () => {
    const { service } = createService();

    await expect(
      service.generateApiToken({
        apiKeyId: 'key_1',
        user: USER,
        workspaceId: 'ws_1',
        expiresIn: undefined as any,
      }),
    ).rejects.toThrow();
  });
});
