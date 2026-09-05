import { useEffect, useState } from "react";

/* OS-driven dark-mode detection. the app has no in-app theme toggle; it follows
   prefers-color-scheme. anything that needs literal theme values rather than CSS
   variables (the price chart, which hands lightweight-charts real hex colours)
   reads the current mode from here, and re-runs when the OS setting flips.

   first render is light; the value corrects on mount. that matches the chart's
   effect, which rebuilds whenever this flips. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return dark;
}
