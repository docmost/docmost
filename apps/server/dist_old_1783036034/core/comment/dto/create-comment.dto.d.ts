import { z } from 'zod';
export declare const yjsSelectionSchema: z.ZodObject<{
    anchor: z.ZodObject<{
        type: z.ZodObject<{
            client: z.ZodNumber;
            clock: z.ZodNumber;
        }, z.core.$strip>;
        tname: z.ZodNullable<z.ZodString>;
        item: z.ZodNullable<z.ZodObject<{
            client: z.ZodNumber;
            clock: z.ZodNumber;
        }, z.core.$strip>>;
        assoc: z.ZodNumber;
    }, z.core.$strip>;
    head: z.ZodObject<{
        type: z.ZodObject<{
            client: z.ZodNumber;
            clock: z.ZodNumber;
        }, z.core.$strip>;
        tname: z.ZodNullable<z.ZodString>;
        item: z.ZodNullable<z.ZodObject<{
            client: z.ZodNumber;
            clock: z.ZodNumber;
        }, z.core.$strip>>;
        assoc: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare class CreateCommentDto {
    pageId: string;
    content: any;
    selection: string;
    type: string;
    parentCommentId: string;
    yjsSelection?: {
        anchor: any;
        head: any;
    };
}
