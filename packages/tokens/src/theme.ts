import {
  accentColors,
  lookDensity,
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
  type ShadowLayer,
  type Shadows,
} from "./tokens";

// Every value of one look, accent and density, resolved: the object-side
// counterpart of the CSS cascade in tokens.css. 32 keys.
export type Theme = Palette & AccentValues & DensityValues & Radii & Shadows;

// A copy, so a caller that changes its theme does not change the tokens.
const copyLayers = (layers: ShadowLayer[]): ShadowLayer[] =>
  layers.map((l) => ({ ...l }));

export function getTheme(look: Look, accent: Accent, density?: Density): Theme {
  return {
    ...palettes[look],
    ...accentColors[look][accent],
    ...densityValues[density ?? lookDensity[look]],
    ...radii[look],
    shadow: copyLayers(shadows[look].shadow),
    pop: copyLayers(shadows[look].pop),
  };
}
