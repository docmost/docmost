import { HTML_BLOCK_MESSAGE_TYPE } from "@/ee/html-block/html-block.constants";
import { HtmlBlockFrameTheme } from "@/ee/html-block/types/html-block.types";

const FULL_DOCUMENT_PATTERN = /<!doctype\s+html|<html[\s>]/i;
const BODY_END_PATTERN = /<\/body\s*>/gi;
const HEAD_OPEN_PATTERN = /<head(?=[\s>])/i;
const HTML_OPEN_PATTERN = /<html(?=[\s>])/i;
const DOCTYPE_OPEN_PATTERN = /<!doctype/i;
const BASE_HREF_PATTERN = /<base(?:\s[^<>]*?)?\shref\s*=/i;

// a srcdoc frame resolves URLs against the parent page, so relative paths would reach the app server
const BASE_TAG = '<base href="about:srcdoc">';

// protocol-relative URLs cannot resolve against about:srcdoc, so src and href values get https instead
const PROTOCOL_RELATIVE_URL_PATTERN = /(\s(?:src|href)\s*=\s*["']?)\/\/(?!\/)/gi;

// storage and cookies throw in an opaque-origin frame, so scripts get in-memory stand-ins
const STORAGE_SHIM_SCRIPT = `<script>(function(){
function memoryStorage(){var items=Object.create(null),store={key:function(i){var k=Object.keys(items)[i];return k===undefined?null:k},getItem:function(k){k=String(k);return k in items?items[k]:null},setItem:function(k,v){items[String(k)]=String(v)},removeItem:function(k){delete items[String(k)]},clear:function(){items=Object.create(null)}};Object.defineProperty(store,"length",{get:function(){return Object.keys(items).length}});return store}
["localStorage","sessionStorage"].forEach(function(name){try{window[name]}catch(e){var store=memoryStorage();try{Object.defineProperty(window,name,{configurable:true,get:function(){return store}})}catch(f){}}});
try{document.cookie}catch(e){var jar=Object.create(null);try{Object.defineProperty(document,"cookie",{configurable:true,get:function(){var pairs=[];for(var name in jar)pairs.push(name+"="+jar[name]);return pairs.join("; ")},set:function(value){var pair=String(value).split(";")[0],eq=pair.indexOf("="),name=pair.slice(0,eq).trim();if(eq>0&&name)jar[name]=pair.slice(eq+1).trim()}})}catch(f){}}
})();</script>`;

const FRAME_SCRIPT = `<script>(() => {
  const postHeight = () => {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    parent.postMessage({ type: ${JSON.stringify(HTML_BLOCK_MESSAGE_TYPE)}, height }, "*");
  };
  addEventListener("load", postHeight);
  new ResizeObserver(postHeight).observe(document.documentElement);
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link || link.hasAttribute("target")) return;
    const href = link.getAttribute("href").trim().toLowerCase();
    if (href.startsWith("#") || href.startsWith("javascript:")) return;
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  }, true);
})();</script>`;

export function isFullHtmlDocument(html: string): boolean {
  return FULL_DOCUMENT_PATTERN.test(html);
}

// one forward scan: if no ">" follows the first opener, none follows a later one, so crafted input stays linear
function findTagEnd(html: string, opener: RegExp): number | null {
  const match = opener.exec(html);
  if (!match) return null;
  const close = html.indexOf(">", match.index + match[0].length);
  return close === -1 ? null : close + 1;
}

export function buildHtmlBlockSrcdoc(
  html: string,
  theme: HtmlBlockFrameTheme,
): string {
  const content = html.replace(PROTOCOL_RELATIVE_URL_PATTERN, "$1https://");
  const base = BASE_HREF_PATTERN.test(content) ? "" : BASE_TAG;

  if (isFullHtmlDocument(content)) {
    const shimAt =
      findTagEnd(content, HEAD_OPEN_PATTERN) ??
      findTagEnd(content, HTML_OPEN_PATTERN) ??
      findTagEnd(content, DOCTYPE_OPEN_PATTERN) ??
      0;
    const shimmed =
      content.slice(0, shimAt) +
      STORAGE_SHIM_SCRIPT +
      base +
      content.slice(shimAt);

    let bodyEnd = -1;
    for (const match of shimmed.matchAll(BODY_END_PATTERN)) {
      bodyEnd = match.index;
    }

    return bodyEnd === -1
      ? shimmed + FRAME_SCRIPT
      : shimmed.slice(0, bodyEnd) + FRAME_SCRIPT + shimmed.slice(bodyEnd);
  }

  return [
    "<!doctype html>",
    "<html><head>",
    STORAGE_SHIM_SCRIPT,
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    base,
    `<style>:root { color-scheme: ${theme.colorScheme}; } `,
    `body { margin: 0; font-family: ${theme.fontFamily}; color: ${theme.textColor}; `,
    `font-size: ${theme.fontSize}; line-height: 1.6; }</style>`,
    "</head><body>",
    content,
    FRAME_SCRIPT,
    "</body></html>",
  ].join("");
}
