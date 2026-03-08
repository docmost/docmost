import { CSSProperties } from "react";

const colorMap: Record<string, { bg: string; bgDark: string; text: string; textDark: string }> = {
  gray: { bg: "#f1f3f5", bgDark: "#373a40", text: "#495057", textDark: "#ced4da" },
  red: { bg: "#ffe3e3", bgDark: "#4a1a1a", text: "#c92a2a", textDark: "#ffa8a8" },
  pink: { bg: "#ffdeeb", bgDark: "#4a1a2e", text: "#a61e4d", textDark: "#faa2c1" },
  grape: { bg: "#f3d9fa", bgDark: "#3b1a4a", text: "#862e9c", textDark: "#e599f7" },
  violet: { bg: "#e5dbff", bgDark: "#2b1a4a", text: "#5f3dc4", textDark: "#b197fc" },
  indigo: { bg: "#dbe4ff", bgDark: "#1a2b4a", text: "#364fc7", textDark: "#91a7ff" },
  blue: { bg: "#d0ebff", bgDark: "#1a2e4a", text: "#1971c2", textDark: "#74c0fc" },
  cyan: { bg: "#c3fae8", bgDark: "#1a3a3a", text: "#0c8599", textDark: "#66d9e8" },
  teal: { bg: "#c3fae8", bgDark: "#1a3a2e", text: "#087f5b", textDark: "#63e6be" },
  green: { bg: "#d3f9d8", bgDark: "#1a3a1a", text: "#2b8a3e", textDark: "#69db7c" },
  lime: { bg: "#e9fac8", bgDark: "#2e3a1a", text: "#5c940d", textDark: "#a9e34b" },
  yellow: { bg: "#fff3bf", bgDark: "#3a351a", text: "#e67700", textDark: "#ffd43b" },
  orange: { bg: "#ffe8cc", bgDark: "#3a2a1a", text: "#d9480f", textDark: "#ffa94d" },
};

export function choiceColor(color: string): CSSProperties {
  const c = colorMap[color] ?? colorMap.gray;
  return {
    backgroundColor: `light-dark(${c.bg}, ${c.bgDark})`,
    color: `light-dark(${c.text}, ${c.textDark})`,
  };
}
