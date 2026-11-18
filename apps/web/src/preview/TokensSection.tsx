// The 32 custom properties of TOKI-009 R10, in the order of tokens.css.
const TOKEN_NAMES = [
  // 17 base colours
  "--bg",
  "--surface",
  "--surface-2",
  "--ink",
  "--ink-2",
  "--muted",
  "--line",
  "--mention-bg",
  "--mention-ink",
  "--danger",
  "--danger-soft",
  "--live",
  "--on-live",
  "--idea",
  "--idea-soft",
  "--hover",
  "--scrim",
  // 4 accent values
  "--accent",
  "--on-accent",
  "--accent-soft",
  "--accent-text",
  // 4 avatar tints
  "--av-s",
  "--av-l",
  "--av-ts",
  "--av-tl",
  // 3 density numbers
  "--av",
  "--gap",
  "--row",
  // 2 radii, 2 shadows
  "--radius",
  "--radius-sm",
  "--shadow",
  "--pop",
];

const isColour = (value: string) => /^(#|rgba?\()/i.test(value);

// Each value is what the browser computes for the property on the root
// element now. The page renders again when a control changes (R11).
export function TokensSection() {
  const style = getComputedStyle(document.documentElement);
  return (
    <section
      className="pv-section"
      data-section="tokens"
      data-count={TOKEN_NAMES.length}
    >
      <h2 className="pv-heading">Tokens</h2>
      <div className="pv-tokens">
        {TOKEN_NAMES.map((name) => {
          const value = style.getPropertyValue(name).trim();
          return (
            <div className="pv-token" key={name} data-token={name}>
              {isColour(value) ? (
                <span
                  className="pv-swatch"
                  data-swatch=""
                  style={{ background: value }}
                />
              ) : null}
              <code className="pv-token-name">{name}</code>
              <span className="pv-token-value" data-token-value="">
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
