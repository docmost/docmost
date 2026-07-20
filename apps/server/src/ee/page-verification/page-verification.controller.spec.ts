import { Test } from '@nestjs/testing';
import { PageVerificationController } from './page-verification.controller';
import { PageVerificationService } from './page-verification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeatureGateGuard } from '../common/guards/feature-gate.guard';

async function buildController(service: Partial<PageVerificationService>) {
  const module = await Test.createTestingModule({
    controllers: [PageVerificationController],
    providers: [{ provide: PageVerificationService, useValue: service }],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(FeatureGateGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get(PageVerificationController);
}

describe('PageVerificationController review endpoints', () => {
  const user = { id: 'u1' } as any;

  it('delegates submit-for-review to the service', async () => {
    const service = { submit: jest.fn().mockResolvedValue(undefined) };
    const controller = await buildController(service as any);

    await controller.submitForReview({ pageId: 'p1' }, user);

    expect(service.submit).toHaveBeenCalledWith('p1', user);
  });

  it('delegates approve-review to the service', async () => {
    const service = { approve: jest.fn().mockResolvedValue(undefined) };
    const controller = await buildController(service as any);

    await controller.approveReview({ pageId: 'p1' }, user);

    expect(service.approve).toHaveBeenCalledWith('p1', user);
  });

  it('delegates reject-review to the service', async () => {
    const service = { reject: jest.fn().mockResolvedValue(undefined) };
    const controller = await buildController(service as any);
    const body = { pageId: 'p1', comment: 'please fix' };

    await controller.rejectReview(body, user);

    expect(service.reject).toHaveBeenCalledWith(body, user);
  });

  it('delegates request-clarification to the service', async () => {
    const service = {
      requestClarification: jest.fn().mockResolvedValue(undefined),
    };
    const controller = await buildController(service as any);

    await controller.requestClarification({ pageId: 'p1' }, user);

    expect(service.requestClarification).toHaveBeenCalledWith('p1', user);
  });

  it('delegates review-payload to the service and returns its result', async () => {
    const payload = { verification: {}, reviews: [], permissions: {} };
    const service = {
      getReviewPayload: jest.fn().mockResolvedValue(payload),
    };
    const controller = await buildController(service as any);

    const result = await controller.reviewPayload({ pageId: 'p1' }, user);

    expect(service.getReviewPayload).toHaveBeenCalledWith('p1', user);
    expect(result).toBe(payload);
  });
});
