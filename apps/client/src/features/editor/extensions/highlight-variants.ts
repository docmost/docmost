export const HIGHLIGHT_VARIANTS = [
  {
    name: "Default",
    variant: null,
  },
  {
    name: "Blue",
    variant: "blue",
    swatchColor: "#98d8f2",
    legacyColors: ["#c1ecf9"],
  },
  {
    name: "Green",
    variant: "green",
    swatchColor: "#7edb6c",
    legacyColors: ["#acf79f"],
  },
  {
    name: "Purple",
    variant: "purple",
    swatchColor: "#e0d6ed",
    legacyColors: ["#f6f3f8"],
  },
  {
    name: "Red",
    variant: "red",
    swatchColor: "#ffc6c2",
    legacyColors: ["#fdebeb"],
  },
  {
    name: "Yellow",
    variant: "yellow",
    swatchColor: "#f5e275",
    legacyColors: ["#fbf4a2"],
  },
  {
    name: "Orange",
    variant: "orange",
    swatchColor: "#f5c8a9",
    legacyColors: ["#faebdd"],
  },
  {
    name: "Pink",
    variant: "pink",
    swatchColor: "#f5cfe0",
    legacyColors: ["#faf1f5"],
  },
  {
    name: "Gray",
    variant: "gray",
    swatchColor: "#dfdfd7",
    legacyColors: ["#f1f1ef"],
  },
] as const;

type VariantValue = (typeof HIGHLIGHT_VARIANTS)[number]["variant"];

export type HighlightVariant = Exclude<VariantValue, null>;

export const HIGHLIGHT_VARIANTS_WITH_VALUE = HIGHLIGHT_VARIANTS.filter(
  variant => variant.variant !== null
) as Array<
  Extract<(typeof HIGHLIGHT_VARIANTS)[number], { variant: HighlightVariant }>
>;

export const HIGHLIGHT_LEGACY_COLOR_MAP: Record<string, HighlightVariant> = {};

HIGHLIGHT_VARIANTS_WITH_VALUE.forEach(({ variant, swatchColor, legacyColors }) => {
  const colors = new Set(
    [...(legacyColors ?? []), swatchColor].filter(
      (color): color is string => Boolean(color)
    )
  );

  colors.forEach(color => {
    HIGHLIGHT_LEGACY_COLOR_MAP[color.toLowerCase()] = variant;
  });
});
