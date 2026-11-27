import {
  accentColors,
  lookDensity,
  densityValues,
  palettes,
  radii,
  shadows,
  sideColours,
  type Accent,
  type AccentValues,
  type Density,
  type DensityValues,
  type Look,
  type Scheme,
  type Palette,
  type Radii,
  type ShadowLayer,
  type Shadows,
  type SideColours,
} from "./tokens";

// Every value of one look, accent and density, resolved: the object-side
// counterpart of the CSS cascade in tokens.css. 32 keys.
export type Theme = Palette & AccentValues & DensityValues & Radii & Shadows;

// A copy, so a caller that changes its theme does not change the tokens.
const copyLayers = (layers: ShadowLayer[]): ShadowLayer[] =>
  layers.map((l) => ({ ...l }));

export function getTheme(
  look: Look,
  scheme: Scheme,
  accent: Accent,
  density?: Density,
): Theme {
  return {
    ...palettes[look][scheme],
    ...accentColors[look][scheme][accent],
    ...densityValues[density ?? lookDensity[look]],
    ...radii[look],
    shadow: copyLayers(shadows[look][scheme].shadow),
    pop: copyLayers(shadows[look][scheme].pop),
  };
}

// The six sidebar colours of a scheme, as a copy (TOKI-144 R1).
export function getSideColours(scheme: Scheme): SideColours {
  return { ...sideColours[scheme] };
}
