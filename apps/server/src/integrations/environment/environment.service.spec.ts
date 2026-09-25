import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from './environment.service';

describe('EnvironmentService', () => {
  async function createService(
    env: Record<string, string> = {},
  ): Promise<EnvironmentService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) =>
              env[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    return module.get<EnvironmentService>(EnvironmentService);
  }

  it('should be defined', async () => {
    expect(await createService()).toBeDefined();
  });

  describe('PlantUML configuration', () => {
    it('defaults to the official PlantUML server', async () => {
      const service = await createService();
      expect(service.getPlantumlUrl()).toBe('https://www.plantuml.com/plantuml');
    });

    it('returns a configured PlantUML url', async () => {
      const service = await createService({
        PLANTUML_URL: 'https://plantuml.internal.example.com',
      });
      expect(service.getPlantumlUrl()).toBe(
        'https://plantuml.internal.example.com',
      );
    });

    it('rejects a PlantUML url with a non-http scheme', async () => {
      const service = await createService({ PLANTUML_URL: 'file:///etc/passwd' });
      expect(service.getPlantumlUrl()).toBe('https://www.plantuml.com/plantuml');
    });

    it('rejects a malformed PlantUML url', async () => {
      const service = await createService({ PLANTUML_URL: 'not a url' });
      expect(service.getPlantumlUrl()).toBe('https://www.plantuml.com/plantuml');
    });




    it('defaults the format to svg', async () => {
      const service = await createService();
      expect(service.getPlantumlFormat()).toBe('svg');
    });

    it('returns png when configured', async () => {
      const service = await createService({ PLANTUML_FORMAT: 'png' });
      expect(service.getPlantumlFormat()).toBe('png');
    });

    it('falls back to svg for an unknown format', async () => {
      const service = await createService({ PLANTUML_FORMAT: 'gif' });
      expect(service.getPlantumlFormat()).toBe('svg');
    });
  });
});
