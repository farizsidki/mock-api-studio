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
let current = null;

function render(name) {
  if (current) current.unmount();
  clear(main);
  shell.classList.remove("nav-open");
  toggle.setAttribute("aria-expanded", "false");
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
  main.focus();
}

toggle.addEventListener("click", () => {
  const open = shell.classList.toggle("nav-open");
  toggle.setAttribute("aria-expanded", String(open));
});

startRouter(render);
