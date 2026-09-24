"use client";

import { useEffect, useRef } from "react";
import { usd } from "@/lib/format";

export type FieldSeries = { ticker: string; price: number; points: number[] };

type Line = {
  ticker: string;
  price: number;
  path: Path2D;
  xs: number[];
  ys: number[];
  delay: number;
};

// how far a line's own movement may bend it, in css px. a repo's price moves
// a fraction of a percent a day, so drawn to the same scale as the vertical
// placement every line would be dead flat; each line's last ten prices are
// scaled to its own range and allowed this much bend. placement is to scale.
const BEND = 7;
const INTRO_SPREAD = 900; // ms between the first and last line starting
const INTRO_DRAW = 1400; // ms for one line to draw across
const FLASH = 1400; // ms for an updated line to fade back

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/* the landing hero's backdrop: the whole market as a field of hairlines.
   every line is a real listing. its height is its price (log scale, so a $5
   listing and a $2,000 one both fit), and its shape is its last ten prices.

   it draws itself in once, left to right. after that it only moves when the
   data does: a listing whose price changes on the next poll flashes in the
   accent and settles. with a mouse, hovering reads a line out. */
export function PriceField({ series, className }: { series: FieldSeries[]; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // everything the draw loop reads lives in refs, so a pointer move or a
  // new frame never goes through React
  const lines = useRef<Line[]>([]);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const start = useRef<number | null>(null);
  const reduced = useRef(false);
  const flashes = useRef(new Map<string, number>());
  const lastPrices = useRef(new Map<string, number>());
  const hover = useRef<{ i: number; x: number; y: number } | null>(null);
  const label = useRef({ x: 0, y: 0, shown: false });
  const frame = useRef<number | null>(null);
  const seriesRef = useRef(series);

  const layout = () => {
    const { w, h } = size.current;
    const data = seriesRef.current.filter((s) => s.price > 0);
    if (!w || !h || data.length === 0) {
      lines.current = [];
      return;
    }
    // the intro starts when there's something to draw, not when the canvas
    // first mounts, so a slow fetch doesn't skip it
    if (lines.current.length === 0) start.current = null;
    const sorted = [...data].sort((a, b) => a.price - b.price);
    const logs = sorted.map((s) => Math.log10(s.price));
    const lo = Math.min(...logs);
    const hi = Math.max(...logs);
    const top = h * 0.1;
    const bottom = h * 0.9;

    lines.current = sorted.map((s, i) => {
      const t = hi > lo ? (logs[i] - lo) / (hi - lo) : 0.5;
      const base = bottom - t * (bottom - top);
      const pts = s.points.length >= 2 ? s.points : [s.price, s.price];
      const min = Math.min(...pts);
      const max = Math.max(...pts);
      const mid = (min + max) / 2;
      const range = max - min;
      const xs = pts.map((_, k) => -0.02 * w + (k / (pts.length - 1)) * 1.04 * w);
      const ys = pts.map((v) => base - (range > 0 ? ((v - mid) / range) * 2 * BEND : 0));

      // catmull-rom through the points, as cubic beziers
      const path = new Path2D();
      path.moveTo(xs[0], ys[0]);
      for (let k = 0; k < xs.length - 1; k++) {
        const x0 = xs[k - 1] ?? xs[k], y0 = ys[k - 1] ?? ys[k];
        const x3 = xs[k + 2] ?? xs[k + 1], y3 = ys[k + 2] ?? ys[k + 1];
        path.bezierCurveTo(
          xs[k] + (xs[k + 1] - x0) / 6, ys[k] + (ys[k + 1] - y0) / 6,
          xs[k + 1] - (x3 - xs[k]) / 6, ys[k + 1] - (y3 - ys[k]) / 6,
          xs[k + 1], ys[k + 1]
        );
      }
      return { ticker: s.ticker, price: s.price, path, xs, ys, delay: (i / sorted.length) * INTRO_SPREAD };
    });
  };

  const yAt = (line: Line, x: number) => {
    const { xs, ys } = line;
    if (x <= xs[0]) return ys[0];
    for (let k = 0; k < xs.length - 1; k++) {
      if (x <= xs[k + 1]) {
        const f = (x - xs[k]) / (xs[k + 1] - xs[k]);
        return ys[k] + f * (ys[k + 1] - ys[k]);
      }
    }
    return ys[ys.length - 1];
  };

  const draw = (now: number) => {
    frame.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { w, h, dpr } = size.current;
    if (start.current === null) start.current = now;
    const elapsed = reduced.current ? Infinity : now - start.current;

    const css = getComputedStyle(canvas);
    const ink = css.getPropertyValue("--ink").trim() || "#EDEDE0";
    const brand = css.getPropertyValue("--brand").trim() || "#DCEC3A";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;

    let animating = false;
    const hovered = hover.current?.i ?? -1;
    const baseAlpha = hovered >= 0 ? 0.13 : 0.2;

    lines.current.forEach((line, i) => {
      const p = Math.min(1, Math.max(0, (elapsed - line.delay) / INTRO_DRAW));
      if (p <= 0) {
        animating = true;
        return;
      }
      if (p < 1) animating = true;
      ctx.save();
      if (p < 1) {
        ctx.beginPath();
        ctx.rect(0, 0, easeOut(p) * w, h);
        ctx.clip();
      }
      ctx.globalAlpha = baseAlpha;
      ctx.strokeStyle = ink;
      ctx.stroke(line.path);

      const flashedAt = flashes.current.get(line.ticker);
      if (flashedAt !== undefined) {
        const k = 1 - (now - flashedAt) / FLASH;
        if (k > 0) {
          animating = true;
          ctx.globalAlpha = easeOut(k) * 0.9;
          ctx.strokeStyle = brand;
          ctx.lineWidth = 1.5;
          ctx.stroke(line.path);
          ctx.lineWidth = 1;
        } else {
          flashes.current.delete(line.ticker);
        }
      }
      if (i === hovered) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = brand;
        ctx.lineWidth = 1.5;
        ctx.stroke(line.path);
        ctx.lineWidth = 1;
      }
      ctx.restore();
    });

    // the readout trails the pointer on a damped follow rather than sticking
    // to it, so it glides between lines instead of teleporting
    const el = labelRef.current;
    if (el) {
      const target = hover.current;
      if (target && hovered >= 0) {
        const line = lines.current[hovered];
        if (!label.current.shown) {
          label.current = { x: target.x, y: target.y, shown: true };
          el.dataset.shown = "";
        }
        const k = reduced.current ? 1 : 0.22;
        label.current.x += (target.x - label.current.x) * k;
        label.current.y += (target.y - label.current.y) * k;
        if (Math.abs(target.x - label.current.x) > 0.3 || Math.abs(target.y - label.current.y) > 0.3) animating = true;
        el.style.transform = `translate3d(${label.current.x + 14}px, ${label.current.y - 30}px, 0)`;
        const [name, fig] = el.children as unknown as [HTMLElement, HTMLElement];
        const price = usd(line.price);
        if (name.textContent !== line.ticker || fig.textContent !== price) {
          name.textContent = line.ticker;
          fig.textContent = price;
        }
      } else if (label.current.shown) {
        label.current.shown = false;
        delete el.dataset.shown;
      }
    }

    if (animating) schedule();
  };

  const schedule = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(draw);
  };

  // size the canvas to its box at device resolution, and re-lay out on resize
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: width, h: height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      layout();
      schedule();
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      // clear the handle too, or schedule() thinks a frame is still coming
      // and never asks for another (React mounts effects twice in dev)
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // new data: re-lay out, and flash any listing whose price changed since
  // the last poll. the first set of prices never flashes.
  useEffect(() => {
    seriesRef.current = series;
    const now = performance.now();
    const seen = lastPrices.current;
    const first = seen.size === 0;
    series.forEach((s) => {
      const prev = seen.get(s.ticker);
      if (!first && prev !== undefined && prev !== s.price && !reduced.current) flashes.current.set(s.ticker, now);
      seen.set(s.ticker, s.price);
    });
    layout();
    schedule();
  }, [series]); // eslint-disable-line react-hooks/exhaustive-deps

  // hover readout, mouse only. on wide screens the left of the field sits
  // under the headline and is faded out, so it doesn't answer there.
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const wide = rect.width >= 1024;
    let best = -1;
    let dist = 14;
    if (!wide || x > rect.width * 0.42) {
      lines.current.forEach((line, i) => {
        const d = Math.abs(yAt(line, x) - y);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
    }
    hover.current = best >= 0 ? { i: best, x, y: yAt(lines.current[best], x) } : null;
    schedule();
  };
  const onLeave = () => {
    hover.current = null;
    schedule();
  };

  return (
    <div
      ref={wrapRef}
      className={`price-field ${className ?? ""}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* the name is words, so it's Bricolage; only the price is mono */}
      <div ref={labelRef} className="price-field-label">
        <span />
        <span className="figure" />
      </div>
    </div>
  );
}
