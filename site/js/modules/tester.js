import { findHistoryEntry } from "../core/request-history.js";
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
        showScenarios(endpoint);
      });
      const scenario = el("select");
      scenario.append(el("option", { text: "Default response", attrs: { value: "" } }));
      function showScenarios(endpoint) {
        scenario.replaceChildren(el("option", { text: "Default response", attrs: { value: "" } }));
        for (const item of endpoint?.handler?.scenarios || []) {
          scenario.append(el("option", { text: item.name, attrs: { value: item.id } }));
        }
      }
      const recent = el("select");
      function refreshHistory() {
        const selected = recent.value;
        recent.replaceChildren(el("option", { text: "Recent requests", attrs: { value: "" } }));
        if (!deps.requestHistory) return;
        for (const entry of deps.requestHistory.list()) {
          recent.append(el("option", { text: `${entry.method} ${entry.url}`, attrs: { value: entry.id } }));
        }
        recent.value = [...recent.options].some((option) => option.value === selected) ? selected : "";
      }
      refreshHistory();
      recent.addEventListener("change", () => {
        const entry = findHistoryEntry(deps.requestHistory.list(), recent.value);
        if (!entry) return;
        method.value = entry.method;
        url.value = entry.url;
        body.value = entry.bodyText;
        headers.load(entry.headers);
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
          const request = {
            method: method.value,
            url: url.value,
            headers: headerValues,
            bodyText: body.value,
            scenarioId: scenario.value || undefined,
          };
          last = await deps.engine.simulateRequest(request);
          deps.requestHistory?.add(request);
          refreshHistory();
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

      const presetName = el("input", { attrs: { type: "text", placeholder: "Preset name" } });
      const presetSelect = el("select");
      function refreshPresets() {
        presetSelect.replaceChildren(el("option", { text: "Presets", attrs: { value: "" } }));
        for (const preset of deps.presetService?.list() || []) {
          presetSelect.append(el("option", { text: preset.name, attrs: { value: preset.id } }));
        }
      }
      function applyPreset(preset) {
        method.value = preset.method;
        url.value = preset.url;
        body.value = preset.bodyText;
        headers.load(preset.headers);
      }
      refreshPresets();
      presetSelect.addEventListener("change", () => {
        const preset = (deps.presetService?.list() || []).find((item) => item.id === presetSelect.value);
        if (preset) applyPreset(preset);
      });
      const savePreset = el("button", { text: "Save preset", attrs: { type: "button" }, on: { click: () => {
        try {
          deps.presetService.create({
            name: presetName.value,
            method: method.value,
            url: url.value,
            headers: headers.read(),
            bodyText: body.value,
          });
          presetName.value = "";
          setAlert(alert, "");
          refreshPresets();
        } catch (error) {
          setAlert(alert, error.message || "Preset could not be saved");
        }
      } } });
      const deletePreset = el("button", { text: "Delete preset", attrs: { type: "button" }, on: { click: () => {
        if (!presetSelect.value) return;
        deps.presetService.remove(presetSelect.value);
        refreshPresets();
      } } });

      container.append(
        el("h1", { text: "API Tester" }),
        el("p", { className: "muted", text: "Requests are simulated in this browser. Nothing is sent over the network." }),
        alert,
        el("form", { className: "panel", on: {
          submit: (event) => event.preventDefault(),
          keydown: (event) => {
            if (event.ctrlKey && event.key === "Enter") {
              event.preventDefault();
              send.click();
            }
          },
        }, children: [
          field("Saved endpoint", shortcut),
          field("Scenario", scenario),
          field("Recent requests", recent),
          field("Preset name", presetName),
          field("Presets", presetSelect),
          el("div", { className: "actions", children: [savePreset, deletePreset] }),
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
