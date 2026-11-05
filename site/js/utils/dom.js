let fieldSeq = 0;

export function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = String(options.text);
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value == null || value === false) continue;
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  if (options.on) {
    for (const [type, handler] of Object.entries(options.on)) node.addEventListener(type, handler);
  }
  for (const child of options.children ?? []) {
    if (child) node.append(child);
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
}

export function field(labelText, control) {
  const id = control.id || `field-${fieldSeq += 1}`;
  control.id = id;
  return el("div", {
    className: "field",
    children: [
      el("label", { text: labelText, attrs: { for: id } }),
      control,
    ],
  });
}

export function setAlert(node, message) {
  node.textContent = message || "";
  node.hidden = !message;
}

export function chooseDialog({ title, text, choices }) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { attrs: { "aria-label": title } });
    let picked = null;
    const buttons = choices.map((choice) => {
      const button = el("button", {
        className: choice.primary ? "primary" : "",
        text: choice.label,
        attrs: { type: "button" },
      });
      button.addEventListener("click", () => {
        picked = choice.value;
        dialog.close();
      });
      return button;
    });
    const cancel = el("button", { text: "Cancel", attrs: { type: "button" } });
    dialog.append(el("form", {
      attrs: { method: "dialog" },
      children: [
        el("h2", { text: title }),
        el("p", { text }),
        el("div", { className: "actions", children: [...buttons, cancel] }),
      ],
    }));
    cancel.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(picked);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function confirmDialog({ title, text, confirmLabel = "Confirm", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { attrs: { "aria-label": title } });
    const confirm = el("button", {
      className: "primary",
      text: confirmLabel,
      attrs: { type: "submit", value: "confirm" },
    });
    const cancel = el("button", { text: cancelLabel, attrs: { type: "button" } });
    dialog.append(el("form", {
      attrs: { method: "dialog" },
      children: [
        el("h2", { text: title }),
        el("p", { text }),
        el("div", { className: "actions", children: [cancel, confirm] }),
      ],
    }));
    cancel.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      const accepted = dialog.returnValue === "confirm";
      dialog.remove();
      resolve(accepted);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function statusTone(status) {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 400) return "error";
  return "warn";
}

export function createHeaderFields(headers) {
  const box = el("div", { className: "list" });
  function add(name = "", value = "") {
    const nameInput = el("input", { attrs: { type: "text", value: name } });
    const valueInput = el("input", { attrs: { type: "text", value } });
    const row = el("div", {
      className: "header-row",
      children: [
        nameInput,
        valueInput,
        el("button", {
          text: "Remove header",
          attrs: { type: "button" },
          on: { click: () => row.remove() },
        }),
      ],
    });
    row.nameInput = nameInput;
    row.valueInput = valueInput;
    box.append(row);
  }
  const entries = Object.entries(headers || {});
  if (entries.length === 0) add();
  else entries.forEach(([name, value]) => add(name, value));
  return {
    box,
    add,
    read() {
      const result = {};
      const seen = new Set();
      for (const row of box.querySelectorAll(".header-row")) {
        const name = row.nameInput.value.trim();
        const value = row.valueInput.value;
        if (!name && !value) continue;
        if (!name) throw new Error("Header name is required");
        const key = name.toLowerCase();
        if (seen.has(key)) throw new Error("Duplicate header name");
        seen.add(key);
        result[name] = value;
      }
      return result;
    },
    load(nextHeaders) {
      box.replaceChildren();
      const nextEntries = Object.entries(nextHeaders || {});
      if (nextEntries.length === 0) add();
      else nextEntries.forEach(([name, value]) => add(name, value));
    },
    clear() {
      box.replaceChildren();
      add();
    },
  };
}
