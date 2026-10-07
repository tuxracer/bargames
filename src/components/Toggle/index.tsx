type ToggleProps = {
  label: string;
  detail: string;
  checked: boolean;
  onToggle: () => void;
};

/** A labeled switch row for the options panels. */
export const Toggle = ({ label, detail, checked, onToggle }: ToggleProps) => (
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
