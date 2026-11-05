import { confirmDialog, el, field } from "../utils/dom.js";

export function createLogsView(deps) {
  return {
    mount(container) {
      const method = el("select");
      method.append(el("option", { text: "All methods", attrs: { value: "" } }));
      for (const item of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        method.append(el("option", { text: item, attrs: { value: item } }));
      }
      const status = el("input", { attrs: { type: "number", inputmode: "numeric" } });
      const alert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
      const tableWrap = el("div");
      function draw() {
        const filters = {};
        if (method.value) filters.method = method.value;
        if (status.value !== "") {
          const code = Number(status.value);
          if (!Number.isInteger(code)) {
            alert.hidden = false;
            alert.textContent = "Status filter must be an integer";
            return;
          }
          filters.status = code;
        }
        alert.hidden = true;
        const rows = deps.logger.list(filters);
        const body = el("tbody");
        for (const row of rows) {
          body.append(el("tr", { children: [
            el("td", { className: "mono", text: row.timestamp }),
            el("td", { text: row.method }),
            el("td", { className: "mono", text: row.path }),
            el("td", { text: String(row.status) }),
            el("td", { text: `${row.elapsedMs} ms` }),
            el("td", { className: "mono", text: row.matchedEndpointId || "None" }),
          ] }));
        }
        tableWrap.replaceChildren(rows.length === 0
          ? el("p", { className: "muted", text: "No requests in this session." })
          : el("table", { children: [
            el("thead", { children: [el("tr", { children: ["Time", "Method", "Path", "Status", "Duration", "Endpoint"].map((label) => el("th", { text: label })) })] }),
            body,
          ] }));
      }
      container.append(
        el("h1", { text: "Logs" }),
        el("p", { className: "muted", text: "Logs stay in memory for this session, up to 200 entries." }),
        alert,
        el("form", { className: "panel", on: { submit: (event) => { event.preventDefault(); draw(); } }, children: [
          el("div", { className: "grid-2", children: [field("Method", method), field("Status", status)] }),
          el("div", { className: "actions", children: [
            el("button", { className: "primary", text: "Apply filter", attrs: { type: "submit" } }),
            el("button", { text: "Clear Logs", attrs: { type: "button" }, on: { click: async () => {
              const yes = await confirmDialog({ title: "Clear logs", text: "Remove all session logs?", confirmLabel: "Clear Logs" });
              if (!yes) return;
              deps.logger.clear();
              draw();
            } } }),
          ] }),
        ] }),
        tableWrap,
      );
      draw();
    },
    unmount() {},
  };
}
