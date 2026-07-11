import { Token } from 'marked';
interface CalloutToken {
    type: 'callout';
    calloutType: string;
    text: string;
    raw: string;
}
export declare const calloutExtension: {
    name: string;
    level: string;
    start(src: string): number;
    tokenizer(src: string): CalloutToken | undefined;
    renderer(token: Token): string;
};
export {};
