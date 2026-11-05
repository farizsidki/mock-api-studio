const ROUTES = ["dashboard", "endpoints", "tester", "collections", "logs", "docs"];
const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function matchShortcut(event) {
  const tag = event.target?.tagName;
  if (TYPING.has(tag)) return null;
  if (!event.altKey) return null;
  const index = Number(event.key) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= ROUTES.length) return null;
  return ROUTES[index];
}
