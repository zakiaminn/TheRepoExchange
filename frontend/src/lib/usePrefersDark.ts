import { useEffect, useState } from "react";

// tracks the os dark mode setting (prefers-color-scheme) for anything that needs literal
// theme values instead of css variables, like the price chart's colours. the first
// render is light and it corrects on mount
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
