/**
 * Light / dark theme.
 *
 * The user's choice ("system", "light" or "dark") is kept on the device in
 * localStorage. `THEME_INIT_SCRIPT` runs in <head> before the first paint
 * (app/layout.tsx): it resolves the choice against the system setting and
 * writes the result to <html data-theme="light|dark">, which app/globals.css
 * reads. It also keeps the browser's theme-color (status bar, PWA title bar)
 * in step and follows system changes while "system" is chosen.
 *
 * `applyThemePreference` does the same at runtime (hooks/useTheme.ts).
 * Keep the two in sync.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

// Not under the "ft:" prefix: signing out clears those, and the theme is a device setting.
export const THEME_STORAGE_KEY = "fittracker.theme";
/** Dispatched on window after the preference changes in this tab. */
export const THEME_CHANGE_EVENT = "ft:theme-change";

/** The canvas colour of each theme: the browser chrome around the page. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#F5F4F0",
  dark: "#0C0D0F",
};

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DARK_QUERY = "(prefers-color-scheme: dark)";
const META_ATTRIBUTE = "data-ft-theme-color";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** The stored preference ("system" when nothing is stored or storage is blocked). */
export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

/** Writes the resolved theme to <html> and the browser's theme-color. */
export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());
  if (typeof document === "undefined") return resolved;
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-theme-preference", preference);

  // Our own theme-color tag goes first, so it wins over the media-specific
  // ones from the viewport metadata.
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${META_ATTRIBUTE}]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.setAttribute(META_ATTRIBUTE, "");
    document.head.prepend(meta);
  }
  meta.content = THEME_COLORS[resolved];
  return resolved;
}

/** Saves the choice on this device and applies it. */
export function storeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  applyThemePreference(preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/**
 * Inline pre-paint script (no imports: it runs before any bundle). Mirrors
 * readThemePreference + applyThemePreference and follows system changes.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,k=${JSON.stringify(
  THEME_STORAGE_KEY
)},c=${JSON.stringify(THEME_COLORS)},q=window.matchMedia(${JSON.stringify(DARK_QUERY)});function p(){try{var v=localStorage.getItem(k);return v==="light"||v==="dark"?v:"system"}catch(e){return"system"}}function a(){var s=p(),t=s==="system"?(q.matches?"dark":"light"):s;d.setAttribute("data-theme",t);d.setAttribute("data-theme-preference",s);var m=document.head.querySelector("meta[${META_ATTRIBUTE}]");if(!m){m=document.createElement("meta");m.name="theme-color";m.setAttribute("${META_ATTRIBUTE}","");document.head.prepend(m)}m.content=c[t]}a();if(q.addEventListener)q.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===k)a()})}catch(e){}})();`;
