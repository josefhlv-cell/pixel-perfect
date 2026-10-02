export type Theme = "dark" | "light";
export const THEME_KEY = "ri-theme";
/** Inline script run before paint: dark-first, honours saved choice. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.classList.toggle("dark",t!=="light")}catch(e){}})()`;
export function setTheme(t: Theme) {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.classList.toggle("dark", t === "dark");
}
export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
