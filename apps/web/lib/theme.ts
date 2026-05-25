export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";
export const THEME_STORAGE_KEY = "sw-exchange-theme";

export const THEME_INIT_SCRIPT = `(() => {
  const defaultTheme = "${DEFAULT_THEME}";
  const storageKey = "${THEME_STORAGE_KEY}";
  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : defaultTheme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = defaultTheme;
    document.documentElement.style.colorScheme = defaultTheme;
  }
})();`;
