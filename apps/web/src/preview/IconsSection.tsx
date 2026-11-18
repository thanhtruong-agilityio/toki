import { Icon, iconNames } from "@toki/ui-web";
import { ReferenceLine } from "./ReferenceLine";

const SIZES = [12, 18, 24, 30];

// Every icon with its name, and one row of the first icon at four sizes (R9).
export function IconsSection() {
  return (
    <section
      className="pv-section"
      data-section="icons"
      data-count={iconNames.length}
    >
      <h2 className="pv-heading">Icons</h2>
      <ReferenceLine section="icons" />
      <div className="pv-icons">
        {iconNames.map((name) => (
          <div className="pv-icon-cell" key={name} data-icon={name}>
            <Icon name={name} />
            <span className="pv-icon-name">{name}</span>
          </div>
        ))}
      </div>
      <div className="pv-icons pv-icon-sizes">
        {SIZES.map((size) => (
          <div className="pv-icon-cell" key={size} data-icon-size={size}>
            <Icon name={iconNames[0]!} size={size} />
            <span className="pv-icon-name">{size} px</span>
          </div>
        ))}
      </div>
    </section>
  );
}
