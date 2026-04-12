import { Injectable, InternalServerErrorException } from '@nestjs/common';

export interface NextcloudFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  mimeType: string;
  lastModified: string;
}

@Injectable()
export class NextcloudService {
  /**
   * List files via WebDAV PROPFIND
   */
  async listFiles(
    ncUrl: string,
    ncUser: string,
    ncPassword: string,
    path: string,
  ): Promise<NextcloudFile[]> {
    const base = ncUrl.replace(/\/$/, '');
    const encodedPath = path
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/');
    const webdavUrl = `${base}/remote.php/dav/files/${encodeURIComponent(ncUser)}${encodedPath}`;

    const body = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

    let response: Response;
    try {
      response = await fetch(webdavUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${ncUser}:${ncPassword}`).toString('base64'),
          'Content-Type': 'application/xml',
          Depth: '1',
        },
        body,
      });
    } catch (err) {
      throw new InternalServerErrorException(`Cannot reach Nextcloud: ${(err as Error).message}`);
    }

    if (!response.ok && response.status !== 207) {
      throw new InternalServerErrorException(
        `Nextcloud WebDAV error: ${response.status} ${response.statusText}`,
      );
    }

    const xml = await response.text();
    return this.parseWebDavResponse(xml, ncUser, path);
  }

  /**
   * Create a public read-only share via OCS API
   */
  async createShare(
    ncUrl: string,
    ncUser: string,
    ncPassword: string,
    filePath: string,
  ): Promise<{ shareUrl: string; embedUrl: string }> {
    const base = ncUrl.replace(/\/$/, '');
    const ocsUrl = `${base}/ocs/v2.php/apps/files_sharing/api/v1/shares`;

    const params = new URLSearchParams({
      path: filePath,
      shareType: '3', // public link
      permissions: '1', // read only
    });

    let response: Response;
    try {
      response = await fetch(ocsUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${ncUser}:${ncPassword}`).toString('base64'),
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });
    } catch (err) {
      throw new InternalServerErrorException(`Cannot reach Nextcloud: ${(err as Error).message}`);
    }

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Nextcloud share error: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();
    const token: string = json?.ocs?.data?.token;
    if (!token) {
      throw new InternalServerErrorException('Nextcloud did not return a share token');
    }

    const shareUrl = `${base}/s/${token}`;
    const embedUrl = `${base}/s/${token}?embedded=1`;

    return { shareUrl, embedUrl };
  }

  /**
   * Parse WebDAV PROPFIND XML response
   */
  private parseWebDavResponse(xml: string, ncUser: string, basePath: string): NextcloudFile[] {
    const files: NextcloudFile[] = [];

    // Simple regex-based XML parser (no external deps needed)
    const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/g;
    let match: RegExpExecArray;

    const firstResponse = true;
    let isFirst = true;

    while ((match = responseRegex.exec(xml)) !== null) {
      // Skip the first entry (it's the directory itself)
      if (isFirst) {
        isFirst = false;
        continue;
      }

      const block = match[1];

      const hrefMatch = block.match(/<d:href>(.*?)<\/d:href>/);
      const nameMatch = block.match(/<d:displayname>(.*?)<\/d:displayname>/);
      const mimeMatch = block.match(/<d:getcontenttype>(.*?)<\/d:getcontenttype>/);
      const sizeMatch = block.match(/<d:getcontentlength>(.*?)<\/d:getcontentlength>/);
      const modifiedMatch = block.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/);
      const isDir = block.includes('<d:collection/>');

      const href = hrefMatch ? decodeURIComponent(hrefMatch[1]) : '';
      const prefix = `/remote.php/dav/files/${ncUser}`;
      const filePath = href.startsWith(prefix) ? href.slice(prefix.length) : href;

      files.push({
        name: nameMatch ? nameMatch[1] : filePath.split('/').filter(Boolean).pop() || '',
        path: filePath.replace(/\/$/, ''),
        type: isDir ? 'directory' : 'file',
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
        mimeType: mimeMatch ? mimeMatch[1] : isDir ? 'httpd/unix-directory' : 'application/octet-stream',
        lastModified: modifiedMatch ? modifiedMatch[1] : '',
      });
    }

    return files.sort((a, b) => {
      // Directories first, then alphabetical
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
}
