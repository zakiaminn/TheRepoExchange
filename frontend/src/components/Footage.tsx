"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";

export type Clip = { webm?: string; mp4?: string; poster?: string };

// one pause switch for every clip on the page. anything that moves for more
// than five seconds needs a way to stop it, and one control is easier to find
// than one per clip.
const store = {
  paused: false,
  mounted: 0,
  listeners: new Set<() => void>(),
  emit() {
    store.listeners.forEach((l) => l());
  },
};
const subscribe = (l: () => void) => {
  store.listeners.add(l);
  return () => store.listeners.delete(l);
};
const usePaused = () => useSyncExternalStore(subscribe, () => store.paused, () => false);
const useMounted = () => useSyncExternalStore(subscribe, () => store.mounted, () => 0);

/* a muted, looping screen recording. it only loads as it nears the screen,
   plays while it's at least a quarter visible, and pauses when it scrolls
   away. with reduced motion it shows its poster and never plays.

   until a recording exists, it renders a labelled placeholder at the same
   size, so the layout can be judged before anything is shot. */
export function Footage({
  clip,
  label,
  note,
  aspect,
  phone = false,
  className,
}: {
  clip?: Clip;
  label: string;
  note?: string;
  aspect?: string;
  phone?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const paused = usePaused();
  const hasVideo = !!(clip?.webm || clip?.mp4);

  useEffect(() => {
    if (!hasVideo) return;
    store.mounted += 1;
    store.emit();
    return () => {
      store.mounted -= 1;
      store.emit();
    };
  }, [hasVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let visible = false;
    const sync = () => {
      if (visible && !store.paused) video.play().catch(() => {});
      else video.pause();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.intersectionRatio >= 0.25;
        if (visible && video.preload === "none") video.preload = "auto";
        sync();
      },
      { threshold: [0, 0.25], rootMargin: "200px 0px" }
    );
    io.observe(video);
    const unsub = subscribe(sync);
    return () => {
      io.disconnect();
      unsub();
    };
  }, [hasVideo]);

  const screen = hasVideo ? (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      preload="none"
      poster={clip?.poster}
      data-paused={paused || undefined}
      className="block h-full w-full object-cover"
    >
      {/* mp4 first: for flat UI recordings h.264 came out smaller than vp9 */}
      {clip?.mp4 && <source src={clip.mp4} type="video/mp4" />}
      {clip?.webm && <source src={clip.webm} type="video/webm" />}
    </video>
  ) : clip?.poster ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={clip.poster} alt="" loading="lazy" decoding="async" className="block h-full w-full object-cover object-top" />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-paper-2 p-6 text-center">
      <span className="label label-ink">{label}</span>
      {note ? <span className="max-w-[28ch] text-[12px] leading-relaxed text-ink-3">{note}</span> : null}
    </div>
  );

  if (phone) {
    // a plain outline of the device, not a render of one: the rounding is the
    // phone's, the one curved thing on the page because it's a real object
    return (
      <div className={`mx-auto w-[min(17rem,72vw)] rounded-[2.4rem] border border-rule-2 bg-paper p-2 ${className ?? ""}`}>
        <div className="overflow-hidden rounded-[1.9rem] border border-rule" style={{ aspectRatio: aspect ?? "9 / 19.5" }}>
          {screen}
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden border border-rule-2 ${className ?? ""}`} style={{ aspectRatio: aspect ?? "16 / 10" }}>
      {screen}
    </div>
  );
}

/* the page's one pause control. it only appears once there's footage on the
   page to pause. */
export function FootagePause() {
  const paused = usePaused();
  const mounted = useMounted();
  if (mounted === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        store.paused = !store.paused;
        store.emit();
      }}
      aria-label={paused ? "Play background videos" : "Pause background videos"}
      aria-pressed={paused}
      className="ctl ctl-icon fixed bottom-5 right-5 z-40 bg-[var(--paper)] text-ink-2 shadow-[0_0_0_1px_var(--rule)] hover:text-ink"
    >
      {paused ? <Play size={14} strokeWidth={1.75} /> : <Pause size={14} strokeWidth={1.75} />}
    </button>
  );
}
