import { Moon, Sun } from "lucide-react";
import { useTheme } from "../store/theme";
import { Tip } from "./ui";

/** Light / dark switch, used in the app top bar and on the public pages. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "night" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <Tip content={label} side="bottom">
      <button type="button" className="icon-btn theme-btn" onClick={toggle} aria-label={label}>
        {theme === "night" ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
      </button>
    </Tip>
  );
}
