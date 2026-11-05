import { confirmDialog, el, field, setAlert } from "../utils/dom.js";
import { filterEndpoints } from "../utils/endpoint-list.js";
import { createEndpointForm } from "./endpoint-form.js";

export function createEndpointsView(deps) {
  return {
    mount(container) {
      if (deps.getBlockError()) {
        container.append(el("p", { className: "alert", attrs: { role: "alert" }, text: deps.getBlockError().message }));
        return;
      }
      const alert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
      const list = el("div", { className: "list" });
      const editor = el("div");
      const query = el("input", { attrs: { type: "search", placeholder: "Name or path" } });
      const method = el("select");
      const enabled = el("select");
      const sort = el("select");
      for (const item of ["", "GET", "POST", "PUT", "PATCH", "DELETE"]) {
        method.append(el("option", { text: item || "All methods", attrs: { value: item } }));
      }
      for (const item of [["all", "All"], ["enabled", "Enabled"], ["disabled", "Disabled"]]) {
        enabled.append(el("option", { text: item[1], attrs: { value: item[0] } }));
      }
      for (const item of [["name-asc", "Name A-Z"], ["name-desc", "Name Z-A"], ["path-asc", "Path A-Z"]]) {
        sort.append(el("option", { text: item[1], attrs: { value: item[0] } }));
      }
      container.append(
        el("h1", { text: "Endpoints" }),
        alert,
        el("div", { className: "actions", children: [
          el("button", { className: "primary", text: "New endpoint", attrs: { type: "button" }, on: { click: () => openForm() } }),
        ] }),
        el("div", { className: "grid-2", children: [
          field("Search", query),
          field("Method", method),
          field("Enabled", enabled),
          field("Sort", sort),
        ] }),
        editor,
        list,
      );
      for (const control of [query, method, enabled, sort]) control.addEventListener("input", () => draw());
      method.addEventListener("change", () => draw());
      enabled.addEventListener("change", () => draw());
      sort.addEventListener("change", () => draw());

      function draw() {
        list.replaceChildren();
        const stored = deps.endpointService.list();
        const endpoints = filterEndpoints(stored, {
          query: query.value,
          method: method.value,
          enabled: enabled.value,
          sort: sort.value,
        });
        if (stored.length === 0) {
          list.append(el("p", { className: "muted", text: "No endpoints yet." }));
          return;
        }
        if (endpoints.length === 0) {
          list.append(el("p", { className: "muted", text: "No endpoints match." }));
          return;
        }
        for (const endpoint of endpoints) {
          list.append(el("article", { className: "panel", children: [
            el("div", { className: "item-head", children: [
              el("div", { children: [
                el("h2", { text: endpoint.name }),
                el("p", { className: "mono", text: `${endpoint.method} ${endpoint.path}` }),
                el("p", { text: `${endpoint.enabled ? "Enabled" : "Disabled"} · ${endpoint.delayMs} ms · ${endpoint.handler.type}` }),
              ] }),
              el("div", { className: "actions", children: [
                el("button", { text: "Edit", attrs: { type: "button" }, on: { click: () => openForm(endpoint) } }),
                el("button", { text: "Duplicate", attrs: { type: "button" }, on: { click: () => { deps.endpointService.duplicate(endpoint.id); draw(); } } }),
                el("button", {
                  text: endpoint.enabled ? "Disable" : "Enable",
                  attrs: { type: "button" },
                  on: { click: () => { deps.endpointService.setEnabled(endpoint.id, !endpoint.enabled); draw(); } },
                }),
                el("button", {
                  className: "danger",
                  text: "Delete",
                  attrs: { type: "button" },
                  on: { click: () => remove(endpoint) },
                }),
              ] }),
            ] }),
          ] }));
        }
      }

      function openForm(endpoint) {
        editor.replaceChildren(createEndpointForm({
          collections: deps.collectionService.list(),
          initial: endpoint,
          onCancel: () => editor.replaceChildren(),
          onSave: (input) => {
            try {
              if (endpoint) deps.endpointService.update(endpoint.id, input);
              else deps.endpointService.create(input);
              editor.replaceChildren();
              setAlert(alert, "");
              draw();
            } catch (error) {
              setAlert(alert, error.message || "Endpoint could not be saved");
            }
          },
        }));
      }

      async function remove(endpoint) {
        const yes = await confirmDialog({
          title: "Delete endpoint",
          text: `Delete ${endpoint.name}?`,
          confirmLabel: "Delete",
        });
        if (!yes) return;
        deps.endpointService.remove(endpoint.id);
        draw();
      }

      draw();
    },
    unmount() {},
  };
}
