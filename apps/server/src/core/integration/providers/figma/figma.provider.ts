import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationDefinition,
  UnfurlOpts,
  UnfurlResult,
} from '../../registry/integration-provider.interface';
import { FigmaService } from './figma.service';
import { figmaPatterns } from './figma-patterns';

@Injectable()
export class FigmaProvider extends IntegrationProvider {
  definition: IntegrationDefinition = {
    type: 'figma',
    name: 'Figma',
    description: 'Link previews for Figma designs, prototypes, and FigJam boards',
    icon: 'figma',
    capabilities: ['oauth', 'unfurl'],
    oauth: {
      authUrl: 'https://www.figma.com/oauth',
      tokenUrl: 'https://api.figma.com/v1/oauth/token',
      refreshUrl: 'https://api.figma.com/v1/oauth/refresh',
      scopes: ['file_metadata:read'],
      clientAuth: 'basic',
    },
    unfurlPatterns: figmaPatterns,
  };

  constructor(private readonly figmaService: FigmaService) {
    super();
  }

  async unfurl(opts: UnfurlOpts): Promise<UnfurlResult> {
    const { match, accessToken, url } = opts;
    const fileType = match[2];
    const fileKey = match[3];
    return this.figmaService.unfurlFile(accessToken, fileKey, fileType, url);
  }
}
