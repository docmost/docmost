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
}
