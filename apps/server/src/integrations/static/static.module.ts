import { Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { join } from 'path';
import * as fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import { EnvironmentService } from '../environment/environment.service';

@Module({})
export class StaticModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly environmentService: EnvironmentService,
  ) {}

  public async onModuleInit() {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const clientDistPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'client/dist',
    );

    if (fs.existsSync(clientDistPath)) {
      const indexFilePath = join(clientDistPath, 'index.html');
      const windowVar = '<!--window-config-->';

      const configString = {
        env: this.environmentService.getEnv(),
        appUrl: this.environmentService.getAppUrl(),
        isCloud: this.environmentService.isCloud(),
      };

      const windowScriptContent = `<script>window.CONFIG=${JSON.stringify(configString)};</script>`;
      const html = fs.readFileSync(indexFilePath, 'utf8');
      const transformedHtml = html.replace(windowVar, windowScriptContent);

      fs.writeFileSync(indexFilePath, transformedHtml);

      const RENDER_PATH = '*';

      await app.register(fastifyStatic, {
        root: clientDistPath,
        wildcard: false,
      });

      app.get(RENDER_PATH, (req: any, res: any) => {
        const stream = fs.createReadStream(indexFilePath);
        res.type('text/html').send(stream);
      });
    }
  }
}
