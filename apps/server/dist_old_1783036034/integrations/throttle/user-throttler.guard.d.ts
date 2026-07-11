import { ThrottlerGuard } from '@nestjs/throttler';
type AuthedRequest = {
    user?: {
        id?: string;
    };
};
export declare class UserThrottlerGuard extends ThrottlerGuard {
    protected getTracker(req: AuthedRequest): Promise<string>;
}
export {};
