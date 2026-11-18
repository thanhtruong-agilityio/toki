import { useState } from "react";
import {
  applyControls,
  densityChoices,
  readControls,
  writeAddress,
  type Controls,
} from "./controls";
import { accents, looks } from "@toki/tokens";
import { componentExamples } from "@toki/ui-web/examples";
import { ExampleSection } from "./ExampleSection";

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
                  look: readControls(`?look=${event.target.value}`).look,
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
            <span>Accent</span>
            <select
              className="pv-select"
              data-control="accent"
              value={controls.accent}
              onChange={(event) =>
                change({
                  ...controls,
                  accent: readControls(`?accent=${event.target.value}`).accent,
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
                  density: readControls(`?density=${event.target.value}`)
                    .density,
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
      {componentExamples.map((entry) => (
        <ExampleSection
          key={entry.component}
          component={entry.component}
          examples={entry.examples}
        />
      ))}
    </div>
  );
}
