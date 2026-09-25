// the faint engraved rosette behind the landing page's sign-up block, like the guilloche
// linework on banknotes and share certificates. the curve is a hypotrochoid (a
// spirograph), sampled once and drawn as thin concentric strokes. the maths is
// deterministic, so the server and client draw the exact same path. with `engrave` it
// draws itself in once, using the .engrave animation in globals.css. colour and opacity
// come from the parent, this only draws the geometry

const TAU = Math.PI * 2;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// one closed hypotrochoid, normalised into the unit box and returned as an svg path
// string. R/r set the lobe structure, and d is the pen offset (the amplitude of each ring)
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

export function SecurityPaper({ className, engrave }: { className?: string; engrave?: boolean }) {
  const R = 7;
  const r = 3;
  // nested rings with the same lobe structure and shrinking amplitude, so they read as one
  // medallion. point and ring counts stay low since the geometry gets stamped several
  // times and the segment total adds up fast
  const ds = [3.0, 2.4, 1.8, 1.2, 0.6];
  const norm = R - r + ds[0] + 0.02; // largest extent, so everything fits [-1, 1]
  const rings = ds.map((d) => rosette(R, r, d, norm, 640));

  // the ring group is defined once and stamped a few times at small rotations, which
  // weaves it into a denser lattice without adding more paths to the dom
  const stamps = [0, 6, 12, 18];

  return (
    <svg
      className={engrave ? `${className ?? ""} engrave` : className}
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
            <path key={i} d={d} pathLength={1} />
          ))}
        </g>
      </defs>
      {stamps.map((deg) => (
        <use key={deg} href="#trx-rosette" transform={`rotate(${deg})`} />
      ))}
    </svg>
  );
}
