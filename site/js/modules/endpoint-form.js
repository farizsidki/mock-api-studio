import { createHeaderFields, el, field, setAlert } from "../utils/dom.js";

const OPERATIONS = {
  GET: ["list", "getById"],
  POST: ["create"],
  PUT: ["replace"],
  PATCH: ["update"],
  DELETE: ["delete"],
};

function input(value, attrs = {}) {
  return el("input", { attrs: { ...attrs, value: value ?? "" } });
}

export function createEndpointForm({ collections, initial, onSave, onCancel }) {
  const current = initial ?? {
    name: "",
    method: "GET",
    path: "/api/v1/example",
    enabled: true,
    delayMs: 0,
    auth: { enabled: false, type: "bearer", headerName: "Authorization", expectedValue: "" },
    handler: {
      type: "static",
      response: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { success: true, data: [] },
      },
    },
  };
  const alert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
  const name = input(current.name);
  const method = el("select");
  for (const item of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    method.append(el("option", { text: item, attrs: { value: item, selected: item === current.method } }));
  }
  const path = input(current.path);
  const enabled = el("input", { attrs: { type: "checkbox" } });
  enabled.checked = current.enabled;
  const delay = input(String(current.delayMs), { type: "number", min: "0", max: "5000", step: "1" });
  const authEnabled = el("input", { attrs: { type: "checkbox" } });
  authEnabled.checked = Boolean(current.auth?.enabled);
  const authType = el("select");
  for (const item of ["bearer", "apiKey"]) {
    authType.append(el("option", { text: item, attrs: { value: item, selected: current.auth?.type === item } }));
  }
  const headerName = input(current.auth?.headerName || "Authorization");
  const expected = input(current.auth?.expectedValue || "");
  const handlerType = el("select");
  for (const item of ["static", "collection"]) {
    handlerType.append(el("option", {
      text: item,
      attrs: { value: item, selected: current.handler?.type === item },
    }));
  }
  const status = input(String(current.handler?.response?.status ?? 200), { type: "number", min: "100", max: "599", step: "1" });
  const headers = createHeaderFields(current.handler?.response?.headers);
  const body = el("textarea", { text: current.handler?.type === "static" ? JSON.stringify(current.handler.response.body, null, 2) : "{\n  \n}" });
  const collectionSelect = el("select");
  for (const collection of collections) {
    collectionSelect.append(el("option", {
      text: collection.name,
      attrs: { value: collection.id, selected: current.handler?.collectionId === collection.id },
    }));
  }
  const operation = el("select");
  const staticBox = el("div", { children: [field("Status", status), field("Headers", headers.box), el("button", { text: "Add header", attrs: { type: "button" }, on: { click: () => headers.add() } }), field("JSON body", body)] });
  const collectionBox = el("div", { children: [field("Collection", collectionSelect), field("Operation", operation)] });

  function syncOperations() {
    const allowed = OPERATIONS[method.value] || ["list"];
    const selected = operation.value || current.handler?.operation;
    operation.replaceChildren();
    for (const item of allowed) {
      operation.append(el("option", { text: item, attrs: { value: item, selected: item === selected } }));
    }
  }
  function syncHandler() {
    const isStatic = handlerType.value === "static";
    staticBox.classList.toggle("is-hidden", !isStatic);
    collectionBox.classList.toggle("is-hidden", isStatic);
  }
  method.addEventListener("change", syncOperations);
  handlerType.addEventListener("change", syncHandler);
  syncOperations();
  syncHandler();

  const form = el("form", {
    className: "panel",
    children: [
      el("h2", { text: initial?.id ? "Edit endpoint" : "New endpoint" }),
      alert,
      field("Name", name),
      el("div", { className: "grid-2", children: [field("Method", method), field("Path", path)] }),
      field("Delay milliseconds", delay),
      field("Enabled", enabled),
      el("h3", { text: "Simulated authentication" }),
      field("Require authentication", authEnabled),
      el("div", { className: "grid-2", children: [field("Type", authType), field("Header name", headerName)] }),
      field("Expected token or API key", expected),
      field("Handler", handlerType),
      staticBox,
      collectionBox,
      el("div", { className: "actions", children: [
        el("button", { className: "primary", text: "Save endpoint", attrs: { type: "submit" } }),
        el("button", { text: "Cancel", attrs: { type: "button" }, on: { click: () => onCancel() } }),
      ] }),
    ],
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      let handler;
      if (handlerType.value === "static") {
        const raw = body.value.trim();
        handler = {
          type: "static",
          response: {
            status: Number(status.value),
            headers: headers.read(),
            body: raw ? JSON.parse(raw) : null,
          },
        };
      } else {
        if (!collectionSelect.value) throw new Error("Create a collection first");
        handler = {
          type: "collection",
          collectionId: collectionSelect.value,
          operation: operation.value,
        };
      }
      onSave({
        name: name.value,
        method: method.value,
        path: path.value,
        enabled: enabled.checked,
        delayMs: Number(delay.value),
        auth: {
          enabled: authEnabled.checked,
          type: authType.value,
          headerName: headerName.value,
          expectedValue: expected.value,
        },
        handler,
      });
    } catch (error) {
      setAlert(alert, error.message || "Endpoint could not be saved");
    }
  });
  return form;
}
