import { createMockEngine } from "./core/mock-engine.js";
import { createLogger } from "./core/logger.js";
import { resolveRoute, startRouter } from "./core/router.js";
import { sampleWorkspace } from "./fixtures/sample-workspace.js";
import { createCollectionsView } from "./modules/collections.js";
import { createDashboardView } from "./modules/dashboard.js";
import { createDocsView } from "./modules/docs.js";
import { createEndpointsView } from "./modules/endpoints.js";
import { createLogsView } from "./modules/logs.js";
import { createTesterView } from "./modules/tester.js";
import { createCollectionService } from "./services/collection-service.js";
import { createEndpointService } from "./services/endpoint-service.js";
import { createImportExportService } from "./services/import-export-service.js";
import { createStorageService } from "./services/storage-service.js";
import { clear } from "./utils/dom.js";
import { createId } from "./utils/id.js";
import { readTheme, SETTINGS_KEY, themeRecord } from "./utils/theme.js";
import { nowMs, sleep } from "./utils/time.js";

const storageService = createStorageService({
  storage: window.localStorage,
  key: "mockApiStudio:workspace:v1",
});
const endpointService = createEndpointService({
  storageService,
  idGenerator: () => createId("ep"),
});
const collectionService = createCollectionService({
  storageService,
  idGenerator: () => createId("col"),
});
const importExport = createImportExportService({ storageService, clock: nowMs });
const logger = createLogger({ clock: nowMs });
const engine = createMockEngine({
  endpointService,
  collectionService,
  logger,
  sleep,
  clock: nowMs,
});

let blockError = null;
try {
  storageService.loadWorkspace();
} catch (error) {
  blockError = error;
}

const deps = {
  storageService,
  endpointService,
  collectionService,
  importExport,
  engine,
  logger,
  sampleWorkspace,
  getBlockError: () => blockError,
  setBlockError(error) { blockError = error; },
  remount() { render(resolveRoute(window.location.hash)); },
};

const views = {
  dashboard: createDashboardView(deps),
  endpoints: createEndpointsView(deps),
  tester: createTesterView(deps),
  collections: createCollectionsView(deps),
  logs: createLogsView(deps),
  docs: createDocsView(),
};

const main = document.querySelector("#main");
const nav = document.querySelector("#site-nav");
const shell = document.querySelector(".shell");
const toggle = document.querySelector(".nav-toggle");
const themeToggle = document.querySelector("#theme-toggle");
let current = null;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const active = theme === "light" ? "Light" : "Dark";
  themeToggle.textContent = active;
  themeToggle.setAttribute("aria-label", `${active} theme`);
}

function setMenu(open) {
  shell.classList.toggle("nav-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Close" : "Menu";
}

let savedTheme = null;
try {
  savedTheme = localStorage.getItem(SETTINGS_KEY);
} catch {
  savedTheme = null;
}
applyTheme(readTheme(savedTheme, window.matchMedia("(prefers-color-scheme: light)").matches));

themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(theme);
  try {
    localStorage.setItem(SETTINGS_KEY, themeRecord(theme));
  } catch {
    // The chosen colors stay for this view even when settings cannot be stored.
  }
});

function render(name) {
  if (current) current.unmount();
  clear(main);
  setMenu(false);
  try {
    storageService.loadWorkspace();
    blockError = null;
  } catch (error) {
    blockError = error;
  }
  for (const link of nav.querySelectorAll("a")) {
    if (link.getAttribute("href") === `#/${name}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  current = views[name];
  current.mount(main);
  main.focus({ preventScroll: true });
}

toggle.addEventListener("click", () => {
  setMenu(!shell.classList.contains("nav-open"));
});

startRouter(render);
