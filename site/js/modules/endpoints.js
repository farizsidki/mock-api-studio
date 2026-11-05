import { confirmDialog, el, setAlert } from "../utils/dom.js";
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
      container.append(
        el("h1", { text: "Endpoints" }),
        alert,
        el("div", { className: "actions", children: [
          el("button", { className: "primary", text: "New endpoint", attrs: { type: "button" }, on: { click: () => openForm() } }),
        ] }),
        editor,
        list,
      );

      function draw() {
        list.replaceChildren();
        const endpoints = deps.endpointService.list();
        if (endpoints.length === 0) {
          list.append(el("p", { className: "muted", text: "No endpoints yet." }));
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
