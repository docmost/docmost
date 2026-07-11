import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
export interface Response<T> {
    data: T;
}
export declare class TransformHttpResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    private reflector;
    constructor(reflector: Reflector);
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Response<T> | any>;
}
