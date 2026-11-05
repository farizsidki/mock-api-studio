export const SETTINGS_KEY = "mockApiStudio:settings:v1";

export function readTheme(raw, prefersLight) {
  try {
    const theme = JSON.parse(raw).theme;
    if (theme === "light" || theme === "dark") return theme;
  } catch {
    // Missing or broken settings fall through to the system choice.
  }
  return prefersLight ? "light" : "dark";
}

export function themeRecord(theme) {
  return JSON.stringify({ theme });
}
