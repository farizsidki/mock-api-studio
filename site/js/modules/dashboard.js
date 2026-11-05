import { confirmDialog, el, setAlert, statusTone } from "../utils/dom.js";
import { prettyJson } from "../utils/json.js";
import { IMPORT_MAX_BYTES } from "../utils/validation.js";

export function createDashboardView(deps) {
  return {
    mount(container) {
      const alert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
      if (deps.getBlockError()) {
        container.append(recovery(deps, alert));
        return;
      }
      let endpoints;
      let collections;
      try {
        endpoints = deps.endpointService.list();
        collections = deps.collectionService.list();
      } catch (error) {
        deps.setBlockError(error);
        container.append(recovery(deps, alert));
        return;
      }
      const logs = deps.logger.list();
      const recent = logs.slice(-5).reverse();
      const file = el("input", { attrs: { type: "file", accept: "application/json,.json" } });
      file.addEventListener("change", () => importFile(deps, file, alert));
      const blocks = [
        el("h1", { text: "Dashboard" }),
        alert,
        el("section", { className: "stats", children: [
          stat("Active endpoints", endpoints.filter((endpoint) => endpoint.enabled).length),
          stat("Total endpoints", endpoints.length),
          stat("Collections", collections.length),
          stat("Session requests", logs.length),
        ] }),
        el("div", { className: "actions", children: [
          el("a", { className: "button", text: "Open Endpoint Manager", attrs: { href: "#/endpoints" } }),
          el("a", { className: "button", text: "Open API Tester", attrs: { href: "#/tester" } }),
          el("button", { className: "primary", text: "Load sample workspace", attrs: { type: "button" }, on: { click: () => loadSample(deps, alert) } }),
          el("button", { text: "Export workspace", attrs: { type: "button" }, on: { click: () => exportWorkspace(deps, alert) } }),
          el("label", { className: "button", text: "Import workspace", children: [file] }),
          el("button", { className: "danger", text: "Reset workspace", attrs: { type: "button" }, on: { click: () => resetWorkspace(deps, alert) } }),
        ] }),
      ];
      if (endpoints.length === 0 && collections.length === 0) {
        blocks.push(el("section", { className: "panel", children: [
          el("h2", { text: "Empty workspace" }),
          el("p", { text: "Create an endpoint or load the sample workspace to try a request." }),
        ] }));
      }
      blocks.push(el("section", { className: "panel", children: [
          el("h2", { text: "Recent requests" }),
          recent.length === 0
            ? el("p", { className: "muted", text: "No requests in this session." })
            : el("ul", { children: recent.map((entry) => el("li", { children: [
              el("span", { className: "status", attrs: { "data-tone": statusTone(entry.status) }, text: String(entry.status) }),
              el("span", { className: "mono", text: ` ${entry.method} ${entry.path}` }),
            ] })) }),
        ] }));
      container.append(...blocks);
    },
    unmount() {},
  };
}

function stat(label, value) {
  return el("article", { className: "panel stat", children: [el("span", { className: "muted", text: label }), el("strong", { text: String(value) })] });
}

function recovery(deps, alert) {
  const file = el("input", { attrs: { type: "file", accept: "application/json,.json" } });
  file.addEventListener("change", () => importFile(deps, file, alert));
  return el("section", { className: "panel banner", children: [
    el("h1", { text: "Workspace recovery" }),
    el("p", { attrs: { role: "alert" }, text: deps.getBlockError().message }),
    el("p", { text: "Data tersimpan tidak dihapus sampai Anda mereset workspace atau mengimpor cadangan yang valid." }),
    alert,
    el("div", { className: "actions", children: [
      el("button", { className: "danger", text: "Reset workspace", attrs: { type: "button" }, on: { click: () => resetWorkspace(deps, alert) } }),
      el("label", { className: "button", text: "Import workspace", children: [file] }),
      el("button", { text: "Load sample workspace", attrs: { type: "button" }, on: { click: () => loadSample(deps, alert) } }),
    ] }),
  ] });
}

async function loadSample(deps, alert) {
  try {
    if (!deps.getBlockError()) {
      const busy = deps.endpointService.list().length + deps.collectionService.list().length > 0;
      if (busy) {
        const yes = await confirmDialog({
          title: "Load sample workspace",
          text: "This replaces the current workspace.",
          confirmLabel: "Replace",
        });
        if (!yes) return;
      }
    }
    deps.storageService.saveWorkspace(deps.sampleWorkspace);
    deps.setBlockError(null);
    deps.remount();
  } catch (error) {
    setAlert(alert, error.message || "Sample workspace could not be loaded");
  }
}

function exportWorkspace(deps, alert) {
  try {
    const data = deps.importExport.exportWorkspace();
    const url = URL.createObjectURL(new Blob([prettyJson(data)], { type: "application/json" }));
    const link = el("a", { attrs: { href: url, download: "mock-api-studio-workspace.json" } });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    setAlert(alert, error.message || "Export failed");
  }
}

async function importFile(deps, fileInput, alert) {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (!file) return;
  if (file.size > IMPORT_MAX_BYTES) {
    setAlert(alert, "Import file is too large");
    return;
  }
  try {
    const text = await file.text();
    const preview = deps.importExport.validateImport(text);
    if (!preview.ok) {
      setAlert(alert, preview.errors.map((error) => error.message).join(" "));
      return;
    }
    const yes = await confirmDialog({
      title: "Replace workspace",
      text: `Import ${preview.summary.endpoints} endpoints and ${preview.summary.collections} collections.`,
      confirmLabel: "Replace",
    });
    if (!yes) return;
    deps.importExport.importWorkspace(text, { strategy: "replace" });
    deps.setBlockError(null);
    deps.remount();
  } catch (error) {
    setAlert(alert, error.message || "Import failed");
  }
}

async function resetWorkspace(deps, alert) {
  const yes = await confirmDialog({
    title: "Reset workspace",
    text: "Remove saved endpoints and collections from this browser?",
    confirmLabel: "Reset",
  });
  if (!yes) return;
  try {
    deps.storageService.clearWorkspace();
    deps.setBlockError(null);
    deps.remount();
  } catch (error) {
    setAlert(alert, error.message || "Workspace could not be reset");
  }
}
