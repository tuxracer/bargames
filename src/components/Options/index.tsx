import type { Options } from "@/lib/options";
import { THEME_LIST } from "@/lib/theme";

type OptionsPanelProps = {
  options: Options;
  onChange: (options: Options) => void;
  onClose: () => void;
};

type ToggleProps = {
  label: string;
  detail: string;
  checked: boolean;
  onToggle: () => void;
};

const Toggle = ({ label, detail, checked, onToggle }: ToggleProps) => (
  <button
    type="button"
    className="toggle-row"
    aria-pressed={checked}
    onClick={onToggle}
  >
    <span className="toggle-text">
      <span className="toggle-label">{label}</span>
      <span className="toggle-detail">{detail}</span>
    </span>
    <span className={checked ? "toggle toggle-on" : "toggle"}>
      <span className="toggle-knob" />
    </span>
  </button>
);

/** Preferences that outlive a game. Opens over whatever is on the table. */
export const OptionsPanel = ({
  options,
  onChange,
  onClose,
}: OptionsPanelProps) => (
  <div className="setup-backdrop" onClick={onClose}>
    <section
      className="setup panel"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="setup-eyebrow">options</p>
      <h2 className="panel-title">The table</h2>
      <ul className="theme-list">
        {THEME_LIST.map((theme) => (
          <li key={theme.id}>
            <button
              type="button"
              className={
                theme.id === options.theme
                  ? "theme-choice theme-choice-selected"
                  : "theme-choice"
              }
              data-theme={theme.id}
              onClick={() => onChange({ ...options, theme: theme.id })}
            >
              <span className="theme-swatch">
                {(["S", "N", "NE"] as const).map((zone) => (
                  <span
                    key={zone}
                    className="theme-swatch-dot"
                    style={{ background: theme.marbles[zone].css }}
                  />
                ))}
              </span>
              <span className="theme-text">
                <span className="toggle-label">{theme.name}</span>
                <span className="toggle-detail">{theme.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Toggle
        label="Show where a marble can go"
        detail="Rings the holes a lifted marble may land in, hop by hop."
        checked={options.hints}
        onToggle={() => onChange({ ...options, hints: !options.hints })}
      />
      <button type="button" className="button button-primary" onClick={onClose}>
        Done
      </button>
    </section>
  </div>
);
