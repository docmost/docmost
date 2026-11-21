import { afterEach, describe, expect, it } from "vitest";
import { buildHtmlBlockSrcdoc, isFullHtmlDocument } from "./html-block-srcdoc";
import { HTML_BLOCK_MESSAGE_TYPE } from "../html-block.constants";
import { HtmlBlockFrameTheme } from "../types/html-block.types";

const theme: HtmlBlockFrameTheme = {
  colorScheme: "dark",
  fontFamily: '"Inter Variable", sans-serif',
  textColor: "rgb(255, 255, 255)",
  fontSize: "16px",
};

const SCRIPT_PATTERN = /<script>[\s\S]*?<\/script>/g;

const scriptsIn = (html: string) => html.match(SCRIPT_PATTERN) ?? [];

const withoutScripts = (html: string) => html.replace(SCRIPT_PATTERN, "");

const BASE_TAG = '<base href="about:srcdoc">';

const BASE_PATTERN = /<base\b[^>]*>/gi;

const basesIn = (html: string) => html.match(BASE_PATTERN) ?? [];

const withoutInjected = (html: string) =>
  withoutScripts(html).replace(BASE_TAG, "");

const isStorageShim = (script: string) =>
  script.includes("localStorage") && !script.includes(HTML_BLOCK_MESSAGE_TYPE);

const isFrameScript = (script: string) =>
  script.includes(HTML_BLOCK_MESSAGE_TYPE) && !script.includes("localStorage");

describe("isFullHtmlDocument", () => {
  it("detects a doctype or an html element", () => {
    expect(isFullHtmlDocument("<!DOCTYPE html><p>Hi</p>")).toBe(true);
    expect(isFullHtmlDocument("<!doctype   html>")).toBe(true);
    expect(isFullHtmlDocument('<html lang="en"><body></body></html>')).toBe(true);
    expect(isFullHtmlDocument("<HTML><body></body></HTML>")).toBe(true);
  });

  it("treats everything else as a fragment", () => {
    expect(isFullHtmlDocument("<p>Hi</p>")).toBe(false);
    expect(isFullHtmlDocument("<htmlx></htmlx>")).toBe(false);
    expect(isFullHtmlDocument("<div>html</div>")).toBe(false);
    expect(isFullHtmlDocument("")).toBe(false);
  });
});

describe("buildHtmlBlockSrcdoc", () => {
  it("wraps a fragment with the theme values and the two injected scripts", () => {
    const srcdoc = buildHtmlBlockSrcdoc("<p>Mon to Fri</p>", theme);

    expect(srcdoc.startsWith("<!doctype html>")).toBe(true);
    expect(srcdoc).toContain('<meta charset="utf-8">');
    expect(srcdoc).toContain('<meta name="viewport"');
    expect(srcdoc).toContain("color-scheme: dark");
    expect(srcdoc).toContain("margin: 0");
    expect(srcdoc).toContain('font-family: "Inter Variable", sans-serif');
    expect(srcdoc).toContain("color: rgb(255, 255, 255)");
    expect(srcdoc).toContain("font-size: 16px");
    expect(srcdoc).toContain("line-height: 1.6");
    expect(srcdoc).toContain("<p>Mon to Fri</p>");
    expect(srcdoc).toContain(HTML_BLOCK_MESSAGE_TYPE);
    expect(scriptsIn(srcdoc)).toHaveLength(2);
  });

  it("uses the light color scheme in light mode", () => {
    const srcdoc = buildHtmlBlockSrcdoc("<p>Hi</p>", {
      ...theme,
      colorScheme: "light",
    });

    expect(srcdoc).toContain("color-scheme: light");
  });

  it("runs the storage shim first in a fragment, before the user's HTML", () => {
    const srcdoc = buildHtmlBlockSrcdoc("<p>Mon to Fri</p>", theme);
    const [shim, frameScript] = scriptsIn(srcdoc);

    expect(isStorageShim(shim)).toBe(true);
    expect(srcdoc.startsWith(`<!doctype html><html><head>${shim}<meta`)).toBe(true);
    expect(srcdoc.indexOf(shim)).toBeLessThan(srcdoc.indexOf("<p>Mon to Fri</p>"));
    expect(isFrameScript(frameScript)).toBe(true);
    expect(srcdoc.indexOf(frameScript)).toBeGreaterThan(
      srcdoc.indexOf("<p>Mon to Fri</p>"),
    );
  });

  it("points a fragment's relative URLs at the frame, between the storage shim and the style", () => {
    const srcdoc = buildHtmlBlockSrcdoc(
      '<img src="images/x.png"><a href="#target">Down</a>',
      theme,
    );
    const [shim] = scriptsIn(srcdoc);

    expect(basesIn(srcdoc)).toEqual([BASE_TAG]);
    expect(srcdoc.indexOf(BASE_TAG)).toBeGreaterThan(
      srcdoc.indexOf(shim) + shim.length - 1,
    );
    expect(srcdoc.indexOf(BASE_TAG)).toBeLessThan(srcdoc.indexOf("<style>"));
    expect(srcdoc.indexOf(BASE_TAG)).toBeLessThan(srcdoc.indexOf("</head>"));
  });

  it("keeps the storage shim to plain ES5", () => {
    const [shim] = scriptsIn(buildHtmlBlockSrcdoc("<p>Hi</p>", theme));

    expect(shim).not.toMatch(/=>|\bconst\b|\blet\b|`|\bclass\b/);
  });

  it("keeps a full document as it is apart from the two scripts and the base", () => {
    const html =
      '<!DOCTYPE html><html lang="en"><HEAD data-theme="report"><title>Report</title></HEAD><body><p>Hi</p></BODY></html>';

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [shim, frameScript] = scriptsIn(srcdoc);

    expect(withoutInjected(srcdoc)).toBe(html);
    expect(scriptsIn(srcdoc)).toHaveLength(2);
    expect(isStorageShim(shim)).toBe(true);
    expect(isFrameScript(frameScript)).toBe(true);
    expect(
      srcdoc.startsWith(
        `<!DOCTYPE html><html lang="en"><HEAD data-theme="report">${shim}${BASE_TAG}<title>`,
      ),
    ).toBe(true);
    expect(srcdoc.endsWith(`<p>Hi</p>${frameScript}</BODY></html>`)).toBe(true);
    expect(srcdoc).not.toContain("color-scheme");
  });

  it("puts the storage shim right after <html> when there is no head", () => {
    const html = '<html lang="en"><body><p>Hi</p></body></html>';

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [shim] = scriptsIn(srcdoc);

    expect(isStorageShim(shim)).toBe(true);
    expect(srcdoc.startsWith(`<html lang="en">${shim}${BASE_TAG}<body>`)).toBe(
      true,
    );
    expect(withoutInjected(srcdoc)).toBe(html);
  });

  it("does not take a <header> for the head", () => {
    const html = "<!doctype html><html><body><header>Top</header></body></html>";

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [shim] = scriptsIn(srcdoc);

    expect(
      srcdoc.startsWith(`<!doctype html><html>${shim}${BASE_TAG}<body><header>`),
    ).toBe(true);
  });

  it("puts the storage shim right after a doctype when there is no html or head tag", () => {
    const html = "<!doctype html><p>Hi</p>";

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [shim, frameScript] = scriptsIn(srcdoc);

    expect(isStorageShim(shim)).toBe(true);
    expect(srcdoc.startsWith(`<!doctype html>${shim}${BASE_TAG}<p>Hi</p>`)).toBe(
      true,
    );
    expect(srcdoc.endsWith(frameScript)).toBe(true);
    expect(withoutInjected(srcdoc)).toBe(html);
  });

  it("adds the script before the last </body>", () => {
    const html = '<html><body><pre>"</body>"</pre><p>Hi</p></body></html>';

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [, frameScript] = scriptsIn(srcdoc);

    expect(isFrameScript(frameScript)).toBe(true);
    expect(srcdoc.endsWith(`<p>Hi</p>${frameScript}</body></html>`)).toBe(true);
    expect(withoutInjected(srcdoc)).toBe(html);
  });

  it("appends the script to a document without </body>", () => {
    const html = "<!doctype html><html><p>Hi</p>";

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [, frameScript] = scriptsIn(srcdoc);

    expect(isFrameScript(frameScript)).toBe(true);
    expect(srcdoc.endsWith(`<p>Hi</p>${frameScript}`)).toBe(true);
    expect(withoutInjected(srcdoc)).toBe(html);
    expect(scriptsIn(srcdoc)).toHaveLength(2);
  });

  it("adds the base right after the storage shim in a full document without one", () => {
    const html =
      "<!doctype html><html><head><title>Report</title></head><body><img src=\"chart.png\"></body></html>";

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [shim] = scriptsIn(srcdoc);

    expect(basesIn(srcdoc)).toEqual([BASE_TAG]);
    expect(
      srcdoc.startsWith(`<!doctype html><html><head>${shim}${BASE_TAG}<title>`),
    ).toBe(true);
  });

  it("keeps the own base of a full document and adds none", () => {
    const html =
      '<!doctype html><html><head><base href="https://x/"><title>Report</title></head><body><img src="chart.png"></body></html>';

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);

    expect(basesIn(srcdoc)).toEqual(['<base href="https://x/">']);
    expect(withoutScripts(srcdoc)).toBe(html);
  });

  it("still adds the base to a full document whose own base has no href", () => {
    const html =
      '<!doctype html><html><head><base target="_blank"></head><body><a href="#a">A</a></body></html>';

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);
    const [shim] = scriptsIn(srcdoc);

    expect(basesIn(srcdoc)).toEqual([BASE_TAG, '<base target="_blank">']);
    expect(
      srcdoc.startsWith(`<!doctype html><html><head>${shim}${BASE_TAG}<base target`),
    ).toBe(true);
  });

  it("keeps the own base of a fragment and adds none", () => {
    const html = '<base href="https://example.com/"><img src="chart.png">';

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);

    expect(basesIn(srcdoc)).toEqual(['<base href="https://example.com/">']);
    expect(srcdoc).toContain(html);
  });

  it("still adds the base once to a fragment whose own base has no href", () => {
    const srcdoc = buildHtmlBlockSrcdoc(
      '<base target="_blank"><a href="#a">A</a>',
      theme,
    );

    expect(basesIn(srcdoc)).toEqual([BASE_TAG, '<base target="_blank">']);
  });
});

describe("protocol-relative URLs", () => {
  it.each([
    ['<script src="//cdn.example.com/a.js"></script>', '<script src="https://cdn.example.com/a.js"></script>'],
    ["<script src='//cdn.example.com/a.js'></script>", "<script src='https://cdn.example.com/a.js'></script>"],
    ["<script src=//cdn.example.com/a.js></script>", "<script src=https://cdn.example.com/a.js></script>"],
    ['<link rel="stylesheet" href="//cdn.example.com/a.css">', '<link rel="stylesheet" href="https://cdn.example.com/a.css">'],
    ["<link rel='stylesheet' href='//cdn.example.com/a.css'>", "<link rel='stylesheet' href='https://cdn.example.com/a.css'>"],
    ["<link rel=stylesheet href=//cdn.example.com/a.css>", "<link rel=stylesheet href=https://cdn.example.com/a.css>"],
    ['<img src="//cdn.example.com/a.png">', '<img src="https://cdn.example.com/a.png">'],
    ["<img src='//cdn.example.com/a.png'>", "<img src='https://cdn.example.com/a.png'>"],
    ["<img src=//cdn.example.com/a.png>", "<img src=https://cdn.example.com/a.png>"],
    ['<a href="//example.com/a">A</a>', '<a href="https://example.com/a">A</a>'],
    ["<a href='//example.com/a'>A</a>", "<a href='https://example.com/a'>A</a>"],
    ["<a href=//example.com/a>A</a>", "<a href=https://example.com/a>A</a>"],
    ['<IMG SRC="//cdn.example.com/a.png">', '<IMG SRC="https://cdn.example.com/a.png">'],
    ['<img\n  src = "//cdn.example.com/a.png">', '<img\n  src = "https://cdn.example.com/a.png">'],
  ])("gives %s the https scheme", (html, expected) => {
    expect(buildHtmlBlockSrcdoc(html, theme)).toContain(expected);
  });

  it("rewrites them in a full document too", () => {
    const srcdoc = buildHtmlBlockSrcdoc(
      '<!doctype html><html><head><script src="//cdn.example.com/a.js"></script></head><body><img src=\'//cdn.example.com/a.png\'></body></html>',
      theme,
    );

    expect(srcdoc).toContain('<script src="https://cdn.example.com/a.js">');
    expect(srcdoc).toContain("<img src='https://cdn.example.com/a.png'>");
  });

  it.each([
    '<a href="/path">A</a>',
    '<a href="https://x">A</a>',
    '<a href="#a">A</a>',
    '<a href="///x">A</a>',
    '<img data-src="//cdn.example.com/a.png">',
    "<script>// comment\nvar a = 1;</script>",
    '<div style="background: url(//cdn.example.com/a.png)"></div>',
    "<style>.a { background: url(//cdn.example.com/a.png); }</style>",
    "<p>See //example.com for more</p>",
  ])("leaves %s as it is", (html) => {
    expect(buildHtmlBlockSrcdoc(html, theme)).toContain(html);
  });

  it("does not change the HTML it is given", () => {
    const html = '<img src="//cdn.example.com/a.png">';
    const stored = `${html}`;

    const srcdoc = buildHtmlBlockSrcdoc(html, theme);

    expect(html).toBe(stored);
    expect(srcdoc).toContain("https://cdn.example.com/a.png");
    expect(srcdoc).not.toContain('"//cdn.example.com');
  });
});

describe("crafted input", () => {
  const aboutOneMegabyteOf = (unit: string) =>
    unit.repeat(Math.ceil((1024 * 1024) / unit.length));

  it.each([
    ['"<head " after a doctype', "<!doctype html" + aboutOneMegabyteOf("<head ")],
    ['"<html "', aboutOneMegabyteOf("<html ")],
    ['"<!doctype " after a doctype', "<!doctype html" + aboutOneMegabyteOf("<!doctype ")],
    ['"<base "', aboutOneMegabyteOf("<base ")],
    ['" src="', aboutOneMegabyteOf(" src=")],
    ["' href=\"'", aboutOneMegabyteOf(' href="')],
    ['"</body " in a document', "<!doctype html>" + aboutOneMegabyteOf("</body ")],
  ])("builds a srcdoc from about 1 MB of %s in well under a second", (_, html) => {
    const start = performance.now();
    buildHtmlBlockSrcdoc(html, theme);

    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("storage shim", () => {
  const replaced: Array<[object, string, PropertyDescriptor | undefined]> = [];

  const throwOnAccess = (target: object, name: string) => {
    replaced.push([target, name, Object.getOwnPropertyDescriptor(target, name)]);
    const refuse = () => {
      throw new DOMException(
        "The document is sandboxed and lacks the 'allow-same-origin' flag.",
        "SecurityError",
      );
    };
    Object.defineProperty(target, name, {
      configurable: true,
      get: refuse,
      set: refuse,
    });
  };

  const runShim = () => {
    const [shim] = scriptsIn(buildHtmlBlockSrcdoc("<p>Hi</p>", theme));
    new Function(shim.slice("<script>".length, -"</script>".length))();
  };

  afterEach(() => {
    for (const [target, name, descriptor] of replaced.splice(0).reverse()) {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else delete (target as Record<string, unknown>)[name];
    }
  });

  it("gives an in-memory stand-in for storage that throws", () => {
    throwOnAccess(window, "localStorage");
    throwOnAccess(window, "sessionStorage");
    expect(() => window.localStorage).toThrow(DOMException);

    runShim();

    expect(window.localStorage).not.toBe(window.sessionStorage);
    for (const storage of [window.localStorage, window.sessionStorage]) {
      storage.setItem("a", 1 as unknown as string);
      expect(storage.getItem("a")).toBe("1");
      expect(storage.getItem("missing")).toBeNull();
      storage.setItem("b", "two");
      expect(storage.length).toBe(2);
      expect(storage.key(0)).toBe("a");
      expect(storage.key(1)).toBe("b");
      expect(storage.key(2)).toBeNull();
      storage.removeItem("a");
      expect(storage.getItem("a")).toBeNull();
      expect(storage.length).toBe(1);
      storage.clear();
      expect(storage.length).toBe(0);
      expect(storage.getItem("b")).toBeNull();
    }
  });

  it("keeps each storage separate", () => {
    throwOnAccess(window, "localStorage");
    throwOnAccess(window, "sessionStorage");

    runShim();
    window.localStorage.setItem("only", "local");

    expect(window.sessionStorage.getItem("only")).toBeNull();
  });

  it("stores keys that clash with object built-ins", () => {
    throwOnAccess(window, "localStorage");

    runShim();
    window.localStorage.setItem("__proto__", "x");
    window.localStorage.setItem("constructor", "y");

    expect(window.localStorage.getItem("__proto__")).toBe("x");
    expect(window.localStorage.getItem("constructor")).toBe("y");
    expect(window.localStorage.getItem("toString")).toBeNull();
    expect(window.localStorage.length).toBe(2);
  });

  it("gives an in-memory cookie jar when cookies throw", () => {
    throwOnAccess(document, "cookie");
    expect(() => document.cookie).toThrow(DOMException);

    runShim();
    document.cookie = "theme=dark; path=/; max-age=60";
    document.cookie = "lang=en";
    document.cookie = "theme=light";
    document.cookie = "no-value-pair";

    expect(document.cookie).toBe("theme=light; lang=en");
  });

  it("leaves working storage and cookies in place", () => {
    const local = window.localStorage;
    const session = window.sessionStorage;

    runShim();

    expect(window.localStorage).toBe(local);
    expect(window.sessionStorage).toBe(session);
    expect(Object.getOwnPropertyDescriptor(document, "cookie")).toBeUndefined();
  });
});
