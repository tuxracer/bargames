import type { MusicStatus } from "@/components/GameCanvas";
import { Toggle } from "@/components/Toggle";
import type { Sensitivity } from "@/lib/beat";
import { VISUAL_ASPECTS } from "@/lib/options";
import type { Options, VisualAspect } from "@/lib/options";

type VisualsPanelProps = {
  options: Options;
  musicStatus: MusicStatus;
  onChange: (options: Options) => void;
  /** Return to the main options. */
  onBack: () => void;
  onClose: () => void;
};

export const MUSIC_STATUS_LINES: Readonly<Record<MusicStatus, string | null>> =
  {
    off: null,
    starting: "Asking for the microphone",
    listening: "Listening",
    denied: "Microphone blocked. Allow it in your browser's site settings.",
    unsupported: "This browser cannot use the microphone.",
  };

const SENSITIVITIES: readonly { id: Sensitivity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

const ASPECT_LINES: Readonly<
  Record<VisualAspect, { label: string; detail: string }>
> = {
  marbles: {
    label: "Marbles glow",
    detail: "A wave of light runs through the marbles on every beat.",
  },
  bounce: {
    label: "Marbles jump",
    detail: "They hop off the board as the wave passes.",
  },
  halos: {
    label: "Light pools",
    detail: "Light spills onto the board under each marble.",
  },
  rings: {
    label: "Hole rings",
    detail: "The rings around the holes light up as the wave passes. Neon.",
  },
  rim: {
    label: "Rim",
    detail: "The rim pulses and wears the spectrum as a ring. Neon.",
  },
  floor: {
    label: "Floor",
    detail: "Rings of light run out across the grid on every beat. Neon.",
  },
  room: {
    label: "Lamp and room",
    detail:
      "The light over the table and the dark around it move with the bass.",
  },
  overlay: {
    label: "Words",
    detail: "The wordmark and the turn marble pulse too.",
  },
};

/** The music settings: the microphone, how keen it is, and what moves. */
export const VisualsPanel = ({
  options,
  musicStatus,
  onChange,
  onBack,
  onClose,
}: VisualsPanelProps) => (
  <div className="setup-backdrop" onClick={onClose}>
    <section
      className="setup panel"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="setup-eyebrow">options</p>
      <h2 className="panel-title">Music and lights</h2>
      <Toggle
        label="React to music"
        detail="Listens through the microphone and lights the table to the beat. Nothing is recorded or sent anywhere."
        checked={options.music}
        onToggle={() => onChange({ ...options, music: !options.music })}
      />
      {MUSIC_STATUS_LINES[musicStatus] && (
        <p
          className={
            musicStatus === "listening"
              ? "music-status music-status-live"
              : "music-status"
          }
        >
          {MUSIC_STATUS_LINES[musicStatus]}
        </p>
      )}
      <div className="sensitivity">
        <span className="toggle-text">
          <span className="toggle-label">Sensitivity</span>
          <span className="toggle-detail">
            How loud the music has to be before the table reacts.
          </span>
        </span>
        <div className="segmented">
          {SENSITIVITIES.map((level) => (
            <button
              key={level.id}
              type="button"
              className={
                level.id === options.sensitivity
                  ? "segment segment-selected"
                  : "segment"
              }
              onClick={() => onChange({ ...options, sensitivity: level.id })}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>
      <p className="panel-section">Lights</p>
      <ul className="toggle-list">
        {VISUAL_ASPECTS.map((aspect) => (
          <li key={aspect}>
            <Toggle
              label={ASPECT_LINES[aspect].label}
              detail={ASPECT_LINES[aspect].detail}
              checked={options.visuals[aspect]}
              onToggle={() =>
                onChange({
                  ...options,
                  visuals: {
                    ...options.visuals,
                    [aspect]: !options.visuals[aspect],
                  },
                })
              }
            />
          </li>
        ))}
      </ul>
      <div className="panel-buttons">
        <button type="button" className="button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </section>
  </div>
);
