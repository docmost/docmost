import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtType } from '../auth/dto/jwt-payload';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let apiKeyRepo: any;
  let userRepo: any;
  let workspaceRepo: any;
  let tokenService: any;

  const workspaceId = 'ws-1';
  const user = {
    id: 'user-1',
    workspaceId,
    deactivatedAt: null,
    deletedAt: null,
  } as any;
  const workspace = { id: workspaceId } as any;

  beforeEach(() => {
    apiKeyRepo = {
      insertApiKey: jest.fn(),
      findById: jest.fn(),
      findActiveById: jest.fn(),
      updateApiKey: jest.fn(),
      softDelete: jest.fn(),
      updateLastUsed: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { findById: jest.fn() };
    workspaceRepo = { findById: jest.fn() };
    tokenService = { generateApiToken: jest.fn().mockResolvedValue('signed.jwt') };

    service = new ApiKeyService(
      apiKeyRepo,
      userRepo,
      workspaceRepo,
      tokenService,
    );
  });

  describe('createApiKey', () => {
    it('creates a non-expiring key and returns the token once', async () => {
      apiKeyRepo.insertApiKey.mockResolvedValue({ id: 'key-1', name: 'ci' });

      const result = await service.createApiKey(user, workspaceId, {
        name: 'ci',
      });

      expect(apiKeyRepo.insertApiKey).toHaveBeenCalledWith({
        name: 'ci',
        creatorId: user.id,
        workspaceId,
        expiresAt: null,
      });
      // non-expiring -> long-lived ttl string
      expect(tokenService.generateApiToken).toHaveBeenCalledWith(
        expect.objectContaining({ apiKeyId: 'key-1', workspaceId }),
      );
      expect(tokenService.generateApiToken.mock.calls[0][0].expiresIn).toBe(
        '3650d',
      );
      expect(result.token).toBe('signed.jwt');
    });

    it('computes expiresIn (seconds) for a future expiry', async () => {
      apiKeyRepo.insertApiKey.mockResolvedValue({ id: 'key-2', name: 'temp' });
      const future = new Date(Date.now() + 60_000).toISOString();

      await service.createApiKey(user, workspaceId, {
        name: 'temp',
        expiresAt: future,
      });

      const ttl = tokenService.generateApiToken.mock.calls[0][0].expiresIn;
      expect(typeof ttl).toBe('number');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('rejects a past expiry', async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await expect(
        service.createApiKey(user, workspaceId, { name: 'x', expiresAt: past }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(apiKeyRepo.insertApiKey).not.toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    const payload = {
      sub: user.id,
      workspaceId,
      apiKeyId: 'key-1',
      type: JwtType.API_KEY,
    } as any;

    it('returns user + workspace for a valid key and tracks last use', async () => {
      apiKeyRepo.findActiveById.mockResolvedValue({
        id: 'key-1',
        workspaceId,
        expiresAt: null,
      });
      workspaceRepo.findById.mockResolvedValue(workspace);
      userRepo.findById.mockResolvedValue(user);

      const result = await service.validateApiKey(payload);

      expect(result).toEqual({ user, workspace });
      expect(apiKeyRepo.updateLastUsed).toHaveBeenCalledWith('key-1');
    });

    it('rejects when the key is missing/revoked', async () => {
      apiKeyRepo.findActiveById.mockResolvedValue(undefined);
      await expect(service.validateApiKey(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects on workspace mismatch', async () => {
      apiKeyRepo.findActiveById.mockResolvedValue({
        id: 'key-1',
        workspaceId: 'other-ws',
        expiresAt: null,
      });
      await expect(service.validateApiKey(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired key (db expiry in the past)', async () => {
      apiKeyRepo.findActiveById.mockResolvedValue({
        id: 'key-1',
        workspaceId,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.validateApiKey(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects when the owner is disabled', async () => {
      apiKeyRepo.findActiveById.mockResolvedValue({
        id: 'key-1',
        workspaceId,
        expiresAt: null,
      });
      workspaceRepo.findById.mockResolvedValue(workspace);
      userRepo.findById.mockResolvedValue({
        ...user,
        deactivatedAt: new Date(),
      });
      await expect(service.validateApiKey(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('ownership checks', () => {
    it('forbids revoking another user’s key (non-admin)', async () => {
      apiKeyRepo.findById.mockResolvedValue({
        id: 'key-9',
        creatorId: 'someone-else',
        workspaceId,
      });
      await expect(
        service.revokeApiKey(workspaceId, 'key-9', { creatorId: user.id }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(apiKeyRepo.softDelete).not.toHaveBeenCalled();
    });

    it('throws NotFound when updating a missing key', async () => {
      apiKeyRepo.findById.mockResolvedValue(undefined);
      await expect(
        service.updateApiKey(workspaceId, { apiKeyId: 'nope', name: 'n' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
