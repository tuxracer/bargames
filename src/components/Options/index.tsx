import type { MusicStatus } from "@/components/GameCanvas";
import { Toggle } from "@/components/Toggle";
import { MUSIC_STATUS_LINES } from "@/components/Visuals";
import type { Options } from "@/lib/options";
import { THEME_LIST } from "@/lib/theme";

type OptionsPanelProps = {
  options: Options;
  musicStatus: MusicStatus;
  onChange: (options: Options) => void;
  /** Open the music and lights settings. */
  onVisuals: () => void;
  onClose: () => void;
};

/** Preferences that outlive a game. Opens over whatever is on the table. */
export const OptionsPanel = ({
  options,
  musicStatus,
  onChange,
  onVisuals,
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
      <Toggle
        label="Tilt toward the player"
        detail="For a phone flat on the table: the view leans toward whoever is to move, and the words turn to read from their side. The board itself stays put."
        checked={options.facePlayer}
        onToggle={() =>
          onChange({ ...options, facePlayer: !options.facePlayer })
        }
      />
      <button type="button" className="toggle-row" onClick={onVisuals}>
        <span className="toggle-text">
          <span className="toggle-label">Music and lights</span>
          <span
            className={
              musicStatus === "listening"
                ? "toggle-detail music-status-live"
                : "toggle-detail"
            }
          >
            {options.music
              ? (MUSIC_STATUS_LINES[musicStatus] ?? "On")
              : "Off. The table can light up to the music in the room."}
          </span>
        </span>
        <span className="row-chevron">›</span>
      </button>
      <button type="button" className="button button-primary" onClick={onClose}>
        Done
      </button>
    </section>
  </div>
);
