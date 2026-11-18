import {
  accentColors,
  defaultDensity,
  densityValues,
  palettes,
  radii,
  shadows,
  type Accent,
  type AccentValues,
  type Density,
  type DensityValues,
  type Look,
  type Palette,
  type Radii,
  type Shadows,
} from "./tokens";

// Every value of one look, accent and density, resolved: the object-side
// counterpart of the CSS cascade in tokens.css. 32 keys.
export type Theme = Palette & AccentValues & DensityValues & Radii & Shadows;

export function getTheme(look: Look, accent: Accent, density?: Density): Theme {
  return {
    ...palettes[look],
    ...accentColors[look][accent],
    ...densityValues[density ?? defaultDensity[look]],
    ...radii[look],
    ...shadows[look],
  };
}
