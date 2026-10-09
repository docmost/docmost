import { UnfurlPattern } from '../../registry/integration-provider.interface';

export const figmaPatterns: UnfurlPattern[] = [
  {
    regex:
      /^https?:\/\/([\w.-]+\.)?figma\.com\/(file|proto|board|design)\/([0-9a-zA-Z]{22,128})/,
    type: 'figma-file',
  },
];
