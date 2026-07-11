import { Token } from 'marked';
interface MathInlineToken {
    type: 'mathInline';
    text: string;
    raw: string;
}
export declare const mathInlineExtension: {
    name: string;
    level: string;
    start(src: string): number;
    tokenizer(src: string): MathInlineToken | undefined;
    renderer(token: Token): string;
};
export {};
