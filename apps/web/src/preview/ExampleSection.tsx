import { ExampleFigure, type FigureExample } from "./ExampleFigure";

// One entry of componentExamples: heading and the figures. data-count is
// written from the same list that is drawn (R6).
export function ExampleSection({
  component,
  examples,
}: {
  component: string;
  examples: readonly FigureExample[];
}) {
  return (
    <section
      className="pv-section"
      data-section="component"
      data-component={component}
      data-count={examples.length}
    >
      <h2 className="pv-heading">{component}</h2>
      <div className="pv-figures">
        {examples.map((example) => (
          <ExampleFigure
            key={example.id}
            component={component}
            example={example}
          />
        ))}
      </div>
    </section>
  );
}
