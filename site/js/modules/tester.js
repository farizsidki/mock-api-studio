import { createHeaderFields, el, field, setAlert, statusTone } from "../utils/dom.js";
import { prettyJson } from "../utils/json.js";

export function createTesterView(deps) {
  return {
    mount(container) {
      if (deps.getBlockError()) {
        container.append(el("p", { className: "alert", attrs: { role: "alert" }, text: deps.getBlockError().message }));
        return;
      }
      const alert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
      const method = el("select");
      for (const item of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        method.append(el("option", { text: item, attrs: { value: item } }));
      }
      const url = el("input", { attrs: { type: "text", value: "/api/v1/users" } });
      const shortcut = el("select");
      shortcut.append(el("option", { text: "Choose endpoint", attrs: { value: "" } }));
      const endpoints = deps.endpointService.list();
      for (const endpoint of endpoints) {
        shortcut.append(el("option", { text: `${endpoint.method} ${endpoint.path}`, attrs: { value: endpoint.id } }));
      }
      shortcut.addEventListener("change", () => {
        const endpoint = endpoints.find((item) => item.id === shortcut.value);
        if (!endpoint) return;
        method.value = endpoint.method;
        url.value = endpoint.path;
      });
      const headers = createHeaderFields();
      const body = el("textarea");
      const result = el("div", { attrs: { "aria-live": "polite" } });
      const copy = el("button", { text: "Copy Response", attrs: { type: "button", disabled: true } });
      let last = null;
      const send = el("button", { className: "primary", text: "Send Request", attrs: { type: "button" } });
      send.addEventListener("click", async () => {
        try {
          const headerValues = headers.read();
          if (body.value.trim() && !Object.keys(headerValues).some((name) => name.toLowerCase() === "content-type")) {
            headerValues["Content-Type"] = "application/json";
          }
          send.disabled = true;
          send.textContent = "Sending...";
          result.setAttribute("aria-busy", "true");
          last = await deps.engine.simulateRequest({
            method: method.value,
            url: url.value,
            headers: headerValues,
            bodyText: body.value,
          });
          setAlert(alert, "");
          draw(last);
          copy.disabled = false;
        } catch (error) {
          setAlert(alert, error.message || "Request could not be sent");
        } finally {
          send.disabled = false;
          send.textContent = "Send Request";
          result.removeAttribute("aria-busy");
        }
      });
      copy.addEventListener("click", async () => {
        if (!last) return;
        try {
          await navigator.clipboard.writeText(prettyJson({
            status: last.status,
            statusText: last.statusText,
            headers: last.headers,
            body: last.body,
            error: last.error,
          }));
          setAlert(alert, "");
        } catch {
          setAlert(alert, "Copy failed. Select the response and copy it manually.");
        }
      });
      const clearButton = el("button", { text: "Clear", attrs: { type: "button" }, on: { click: () => {
        method.value = "GET";
        url.value = "";
        shortcut.value = "";
        body.value = "";
        headers.clear();
        last = null;
        copy.disabled = true;
        result.replaceChildren();
        setAlert(alert, "");
      } } });

      function draw(response) {
        const headerLines = Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join("\n");
        result.replaceChildren(el("section", { className: "panel", children: [
          el("h2", { text: "Response" }),
          el("p", { children: [
            el("span", { className: "status", attrs: { "data-tone": statusTone(response.status) }, text: `${response.status} ${response.statusText}` }),
            el("span", { text: ` ${response.elapsedMs} ms` }),
          ] }),
          el("p", { text: `Matched endpoint: ${response.matchedEndpointId || "None"}` }),
          el("h3", { text: "Route parameters" }),
          el("pre", { text: prettyJson(response.routeParams) }),
          el("h3", { text: "Headers" }),
          el("pre", { text: headerLines || "(none)" }),
          el("h3", { text: "Body" }),
          el("pre", { text: prettyJson(response.body) }),
          response.error ? el("p", { attrs: { role: "alert" }, text: `${response.error.code}: ${response.error.message}` }) : null,
          el("p", { className: "muted", text: `Request URL: ${url.value}` }),
        ] }));
      }

      container.append(
        el("h1", { text: "API Tester" }),
        el("p", { className: "muted", text: "Requests are simulated in this browser. Nothing is sent over the network." }),
        alert,
        el("form", { className: "panel", on: { submit: (event) => event.preventDefault() }, children: [
          field("Saved endpoint", shortcut),
          el("div", { className: "grid-2", children: [field("Method", method), field("Path and query", url)] }),
          field("Headers", headers.box),
          el("button", { text: "Add header", attrs: { type: "button" }, on: { click: () => headers.add() } }),
          field("JSON body", body),
          el("div", { className: "actions", children: [send, clearButton, copy] }),
        ] }),
        result,
      );
    },
    unmount() {},
  };
}
