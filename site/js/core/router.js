const VIEWS = ["dashboard", "endpoints", "tester", "collections", "logs", "docs"];

export function resolveRoute(hash) {
  const name = String(hash || "").replace(/^#\/?/, "").split("?")[0].replace(/\/$/, "");
  return VIEWS.includes(name) ? name : "dashboard";
}

export function startRouter(onRoute) {
  const render = () => onRoute(resolveRoute(window.location.hash));
  window.addEventListener("hashchange", render);
  if (!window.location.hash) window.location.hash = "#/dashboard";
  else render();
}
