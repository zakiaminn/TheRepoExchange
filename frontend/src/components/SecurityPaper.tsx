/* SECURITY PAPER
   the faint engraved rosette behind the hero and the admission block. it's the
   guilloche linework you find on banknotes, share certificates and passports:
   the literal visual language of the institution TRX writes in. drawn, not
   photographed, so it sits inside the hard-edged system instead of fighting it.

   the curve is a hypotrochoid (the spirograph you drew in school), sampled once
   and rendered as thin concentric strokes. the maths is deterministic, so the
   server and the client draw the exact same path and there's nothing to
   hydrate. it's static by design, so there's no motion to reduce.

   colour and opacity come from the parent (text-brand-ink + a low opacity);
   this component only owns the geometry. */

const TAU = Math.PI * 2;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// one closed hypotrochoid, normalised into the unit box and returned as an SVG
// path string. R/r set the lobe structure; d is the pen offset (the amplitude
// of each ring).
function rosette(R: number, r: number, d: number, norm: number, steps: number): string {
  const rot = r / gcd(R, r); // how many turns until the curve closes on itself
  const k = (R - r) / r;
  let out = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TAU * rot;
    const x = ((R - r) * Math.cos(t) + d * Math.cos(k * t)) / norm;
    const y = ((R - r) * Math.sin(t) - d * Math.sin(k * t)) / norm;
    out += `${i === 0 ? "M" : "L"}${x.toFixed(4)} ${y.toFixed(4)}`;
  }
  return out + "Z";
}

export function SecurityPaper({ className }: { className?: string }) {
  const R = 7;
  const r = 3;
  // nested rings: same lobe structure, shrinking amplitude, so they read as one
  // engraved medallion rather than separate shapes. point counts and ring/stamp
  // counts are kept deliberately lean: this is a faint backdrop, not a plot, and
  // the geometry is stamped several times, so the segment total adds up fast.
  const ds = [3.0, 2.4, 1.8, 1.2, 0.6];
  const norm = R - r + ds[0] + 0.02; // largest extent, so everything fits [-1, 1]
  const rings = ds.map((d) => rosette(R, r, d, norm, 640));

  // the ring group is defined once and stamped a few times at small rotations.
  // the overlapping copies weave the open lattice into the denser, moire-fine
  // linework you see on a banknote, without multiplying the DOM further.
  const stamps = [0, 6, 12, 18];

  return (
    <svg
      className={className}
      viewBox="-1.06 -1.06 2.12 2.12"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.0026}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <g id="trx-rosette">
          {rings.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </defs>
      {stamps.map((deg) => (
        <use key={deg} href="#trx-rosette" transform={`rotate(${deg})`} />
      ))}
    </svg>
  );
}
