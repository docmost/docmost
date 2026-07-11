import { EnvironmentService } from './environment.service';
export declare class DomainService {
    private environmentService;
    constructor(environmentService: EnvironmentService);
    getUrl(hostname?: string): string;
}
