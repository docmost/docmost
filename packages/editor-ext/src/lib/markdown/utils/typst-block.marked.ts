interface TypstBlockToken {
  type: "typstBlock";
  text: string;
  raw: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const typstBlockExtension = {
  name: "typstBlock",
  level: "block",
  start(src: string) {
    return src.match(/```typst/)?.index ?? -1;
  },
  tokenizer(src: string): TypstBlockToken | undefined {
    const rule = /^```typst[ \t]*\n?([\s\S]+?)\n?```/;
    const match = rule.exec(src);

    if (match) {
      return {
        type: "typstBlock",
        raw: match[0],
        text: match[1] ?? "",
      };
    }
  },
  renderer(token: any) {
    const typstBlockToken = token as TypstBlockToken;
    const escaped = escapeHtml(typstBlockToken.text);
    return `<div data-type="${typstBlockToken.type}" data-typst="true">${escaped}</div>`;
  },
};