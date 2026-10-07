import { Injectable } from '@nestjs/common';
import { UnfurlResult } from '../../registry/integration-provider.interface';
import { providerApiFetch } from '../../utils/provider-fetch';

const FIGMA_API = 'https://api.figma.com/v1';

const FILE_TYPE_LABELS: Record<string, string> = {
  design: 'Design file',
  file: 'Design file',
  proto: 'Prototype',
  board: 'FigJam board',
};

@Injectable()
export class FigmaService {
  async unfurlFile(
    accessToken: string,
    fileKey: string,
    fileType: string,
    url: string,
  ): Promise<UnfurlResult> {
    const data = await this.apiGet(accessToken, `/files/${fileKey}/meta`);
    const file = data.file;

    const typeLabel = FILE_TYPE_LABELS[fileType] ?? 'Figma file';

    return {
      title: file.name,
      description: typeLabel,
      url,
      provider: 'figma',
      providerIcon: 'figma',
      author: file.last_touched_by?.handle,
      authorAvatarUrl: file.last_touched_by?.img_url,
      metadata: {
        type: fileType,
        fileKey,
        thumbnailUrl: file.thumbnail_url,
        lastModified: file.last_touched_at,
      },
    };
  }

  private async apiGet(accessToken: string, path: string): Promise<any> {
    const response = await providerApiFetch('Figma', `${FIGMA_API}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    return response.json();
  }
}
