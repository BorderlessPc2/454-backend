export type BrandThemeModeTokens = {
  primary: string;
  primaryForeground: string;
  ring: string;
};

export type BrandThemePalette = {
  light: BrandThemeModeTokens;
  dark: BrandThemeModeTokens;
};

export function isBrandThemePalette(value: unknown): value is BrandThemePalette {
  if (!value || typeof value !== "object") {
    return false;
  }

  const palette = value as BrandThemePalette;
  const modes: Array<keyof BrandThemePalette> = ["light", "dark"];

  return modes.every((mode) => {
    const tokens = palette[mode];
    return (
      tokens &&
      typeof tokens.primary === "string" &&
      typeof tokens.primaryForeground === "string" &&
      typeof tokens.ring === "string"
    );
  });
}

export function parseBrandThemePalette(value: unknown): BrandThemePalette | null {
  return isBrandThemePalette(value) ? value : null;
}
