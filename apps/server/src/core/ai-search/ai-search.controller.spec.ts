import { Test, TestingModule } from '@nestjs/testing';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './services/ai-search.service';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';

describe('AiSearchController', () => {
  let controller: AiSearchController;
  let service: AiSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiSearchController],
      providers: [
        {
          provide: AiSearchService,
          useValue: {
            semanticSearch: jest.fn(),
            hybridSearch: jest.fn(),
            reindexPages: jest.fn(),
          },
        },
        {
          provide: SpaceAbilityFactory,
          useValue: {
            createForUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AiSearchController>(AiSearchController);
    service = module.get<AiSearchService>(AiSearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
}); 