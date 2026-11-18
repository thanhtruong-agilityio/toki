import { Component, type ReactNode } from "react";

// One example of an entry of componentExamples, drawn as the examples file
// gives it, on a --surface panel, inside an error boundary (R6, R7). The
// element is typed by hand so this file imports nothing from @toki/ui-web.
export type FigureExample = { id: string; title: string; element: ReactNode };

type Props = { component: string; example: FigureExample };
type State = { error: Error | null };

export class ExampleFigure extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    const { component, example } = this.props;
    const { error } = this.state;
    return (
      <figure
        className="pv-figure"
        data-example={`${component}/${example.id}`}
        data-failed={error ? "true" : undefined}
      >
        <div className="pv-panel">
          {error ? (
            <p className="pv-failed">This example failed: {error.message}</p>
          ) : (
            example.element
          )}
        </div>
        <figcaption className="pv-caption">{example.title}</figcaption>
      </figure>
    );
  }
}
