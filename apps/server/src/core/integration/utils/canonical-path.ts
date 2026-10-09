// Browsers resolve "." and ".." segments (also written %2e) and read "\" as "/", so such a link opens a different item.
export const CANONICAL_PATH = String.raw`(?![^?#]*(?:\/(?:\.|%2[eE]){1,2}(?:[\/?#]|$)|\\))`;
