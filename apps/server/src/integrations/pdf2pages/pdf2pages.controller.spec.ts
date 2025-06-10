import { Test, TestingModule } from '@nestjs/testing';
import { Pdf2PagesController } from './Pdf2PagesController';

describe('Pdf2PagesController', () => {
  let controller: Pdf2PagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Pdf2PagesController],
    }).compile();

    controller = module.get<Pdf2PagesController>(Pdf2PagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
