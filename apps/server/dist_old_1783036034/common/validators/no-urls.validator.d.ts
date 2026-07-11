import { ValidationOptions } from 'class-validator';
export declare function containsDomain(value: string): boolean;
export declare function NoUrls(validationOptions?: ValidationOptions): (object: object, propertyName: string) => void;
