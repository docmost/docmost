import { Token } from 'marked';
interface MathBlockToken {
    type: 'mathBlock';
    text: string;
    raw: string;
}
export declare const mathBlockExtension: {
    name: string;
    level: string;
    start(src: string): number;
    tokenizer(src: string): MathBlockToken | undefined;
    renderer(token: Token): string;
};
export {};
