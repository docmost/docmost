import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentService } from './attachment.service';

describe('AttachmentService', () => {
  let service: AttachmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttachmentService],
    }).compile();

    service = module.get<AttachmentService>(AttachmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
