import { Injectable } from '@nestjs/common';
import { EnvironmentService } from './environment.service';

@Injectable()
export class DomainService {
  constructor(private environmentService: EnvironmentService) {}

  getUrl(hostname?: string): string {
    if (!this.environmentService.isCloud()) {
      return this.environmentService.getAppUrl();
    }

    const domain = this.environmentService.getSubdomainHost();
    if (!hostname || !domain) {
      return this.environmentService.getAppUrl();
    }

    const protocol = this.environmentService.isHttps() ? 'https' : 'http';
    return `${protocol}://${hostname}.${domain}`;
  }

  // Canonical workspace URL: prefers customDomain, falls back to {hostname}.{cloud-domain},
  // falls back to APP_URL for self-hosted. Used for multi-tenant OAuth return-redirects.
  getWorkspaceUrl(workspace: {
    hostname?: string | null;
    customDomain?: string | null;
  }): string {
    if (!this.environmentService.isCloud()) {
      return this.environmentService.getAppUrl();
    }
    if (workspace.customDomain) {
      const protocol = this.environmentService.isHttps() ? 'https' : 'http';
      return `${protocol}://${workspace.customDomain}`;
    }
    return this.getUrl(workspace.hostname ?? undefined);
  }
}
