import { useState } from "react";
import {
  applyControls,
  densityChoices,
  readControls,
  writeAddress,
  type Controls,
} from "./controls";
import { accents, looks, schemes } from "@toki/tokens";
import { componentExamples } from "@toki/ui-web/examples";
import { ExampleSection } from "./ExampleSection";
import { IconsSection } from "./IconsSection";
import { LiveToasts } from "./LiveToasts";
import { TokensSection } from "./TokensSection";

// The value of a select is one of its own options; an unknown one keeps the old value.
function pickOf<T extends string>(
  allowed: readonly T[],
  value: string,
  fallback: T,
): T {
  return allowed.find((item) => item === value) ?? fallback;
}

const densityLabel: Record<(typeof densityChoices)[number], string> = {
  own: "The look's own",
  comfortable: "Comfortable",
  compact: "Compact",
};

// The page's controls are native selects, not the components under test, so a
// broken component cannot break the controls used to inspect it (R4).
export function PreviewPage() {
  const [controls, setControls] = useState<Controls>(() =>
    readControls(window.location.search),
  );

  function change(next: Controls) {
    setControls(next);
    applyControls(document.documentElement, next);
    writeAddress(window.history, window.location.pathname, next);
  }

  return (
    <div className="pv-page" data-testid="preview-root">
      <header className="pv-header">
        <h1 className="pv-title">Toki component preview</h1>
        <div className="pv-controls">
          <label className="pv-control">
            <span>Look</span>
            <select
              className="pv-select"
              data-control="look"
              value={controls.look}
              onChange={(event) =>
                change({
                  ...controls,
                  look: pickOf(looks, event.target.value, controls.look),
                })
              }
            >
              {looks.map((look) => (
                <option key={look} value={look}>
                  {look}
                </option>
              ))}
            </select>
          </label>
          <label className="pv-control">
            <span>Scheme</span>
            <select
              className="pv-select"
              data-control="scheme"
              value={controls.scheme}
              onChange={(event) =>
                change({
                  ...controls,
                  scheme: pickOf(schemes, event.target.value, controls.scheme),
                })
              }
            >
              {schemes.map((scheme) => (
                <option key={scheme} value={scheme}>
                  {scheme}
                </option>
              ))}
            </select>
          </label>
          <label className="pv-control">
            <span>Accent</span>
            <select
              className="pv-select"
              data-control="accent"
              value={controls.accent}
              onChange={(event) =>
                change({
                  ...controls,
                  accent: pickOf(accents, event.target.value, controls.accent),
                })
              }
            >
              {accents.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </select>
          </label>
          <label className="pv-control">
            <span>Density</span>
            <select
              className="pv-select"
              data-control="density"
              value={controls.density}
              onChange={(event) =>
                change({
                  ...controls,
                  density: pickOf(
                    densityChoices,
                    event.target.value,
                    controls.density,
                  ),
                })
              }
            >
              {densityChoices.map((density) => (
                <option key={density} value={density}>
                  {densityLabel[density]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <TokensSection controls={controls} />
      <IconsSection />
      {componentExamples.map((entry) => (
        <ExampleSection
          key={entry.component}
          component={entry.component}
          examples={entry.examples}
        />
      ))}
      <LiveToasts />
    </div>
  );
}
