import { referenceFor } from "./references";

// The one line of a section with the prototype lines to compare it with (R17).
export function ReferenceLine({ section }: { section: string }) {
  const value = referenceFor(section);
  return (
    <p className="pv-ref" data-prototype-ref={value}>
      Prototype lines: {value}
    </p>
  );
}
