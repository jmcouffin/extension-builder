import { PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { TRACK, useMusic } from "../theme/music";

/**
 * Rendered in every theme and hidden by the stylesheet unless the theme shows
 * it (`.music-control { display: none }` by default). When a theme switch
 * hides it, the music stops: nothing here knows which theme is active, it
 * only notices that it is no longer on screen.
 */
export function MusicControl() {
  const playing = useMusic((s) => s.playing);
  const volume = useMusic((s) => s.volume);
  const { toggle, setVolume, stop } = useMusic.getState();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      if (node.getClientRects().length === 0) stop();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [stop]);

  const percent = Math.round(volume * 100);

  return (
    <div ref={ref} className="music-control" data-testid="music-control">
      <button
        type="button"
        className="music-toggle"
        aria-label={playing ? "Pause music" : "Play music"}
        aria-pressed={playing}
        title={TRACK.title}
        onClick={() => void toggle()}
      >
        {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
      </button>
      <span className="music-status">{playing ? "Now Playing" : "Music Off"}</span>
      <Slider
        className="music-volume w-24"
        aria-label="Music volume"
        min={0}
        max={100}
        step={1}
        value={[percent]}
        onValueChange={([v]) => setVolume((v ?? 50) / 100)}
      />
      <span className="music-volume-value" aria-hidden="true">
        {percent}%
      </span>
    </div>
  );
}
