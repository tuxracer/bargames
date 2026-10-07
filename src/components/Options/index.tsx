import type { Options } from "@/lib/options";

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
      <h2 className="panel-title">How the table helps</h2>
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
