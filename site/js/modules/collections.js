import { confirmDialog, el, field, setAlert } from "../utils/dom.js";

function parseItems(text) {
  const value = JSON.parse(text);
  if (!Array.isArray(value)) throw new Error("Items must be a JSON array");
  return value;
}

export function createCollectionsView(deps) {
  return {
    mount(container) {
      if (deps.getBlockError()) {
        container.append(el("p", { className: "alert", attrs: { role: "alert" }, text: deps.getBlockError().message }));
        return;
      }
      const alert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
      const editor = el("div");
      const list = el("div", { className: "list" });
      container.append(
        el("h1", { text: "Collections" }),
        alert,
        el("div", { className: "actions", children: [
          el("button", { className: "primary", text: "New collection", attrs: { type: "button" }, on: { click: () => openForm() } }),
        ] }),
        editor,
        list,
      );

      function draw() {
        list.replaceChildren();
        const collections = deps.collectionService.list();
        if (collections.length === 0) {
          list.append(el("p", { className: "muted", text: "No collections yet." }));
          return;
        }
        for (const collection of collections) {
          list.append(el("article", { className: "panel", children: [
            el("h2", { text: collection.name }),
            el("p", { className: "mono", text: `${collection.id} · ${collection.idField} · ${collection.idStrategy} · ${collection.items.length} items` }),
            el("div", { className: "actions", children: [
              el("button", { text: "Edit", attrs: { type: "button" }, on: { click: () => openForm(collection) } }),
              el("button", { text: "Reset items", attrs: { type: "button" }, on: { click: () => reset(collection) } }),
              el("button", { className: "danger", text: "Delete", attrs: { type: "button" }, on: { click: () => remove(collection) } }),
            ] }),
          ] }));
        }
      }

      function openForm(collection) {
        const name = el("input", { attrs: { value: collection?.name || "" } });
        const idField = el("input", { attrs: { value: collection?.idField || "id" } });
        const strategy = el("select");
        for (const item of ["autoIncrement", "provided"]) {
          strategy.append(el("option", { text: item, attrs: { value: item, selected: (collection?.idStrategy || "autoIncrement") === item } }));
        }
        const initialItems = el("textarea", { text: JSON.stringify(collection?.initialItems || [], null, 2) });
        const items = el("textarea", { text: JSON.stringify(collection?.items || [], null, 2) });
        const formAlert = el("p", { className: "alert", attrs: { role: "alert", hidden: true } });
        const form = el("form", { className: "panel", children: [
          el("h2", { text: collection ? "Edit collection" : "New collection" }),
          formAlert,
          field("Name", name),
          el("div", { className: "grid-2", children: [field("ID field", idField), field("ID strategy", strategy)] }),
          field("Initial items JSON", initialItems),
          collection ? field("Current items JSON", items) : null,
          el("div", { className: "actions", children: [
            el("button", { className: "primary", text: "Save collection", attrs: { type: "submit" } }),
            el("button", { text: "Cancel", attrs: { type: "button" }, on: { click: () => editor.replaceChildren() } }),
          ] }),
        ] });
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          try {
            const input = {
              name: name.value,
              idField: idField.value,
              idStrategy: strategy.value,
              initialItems: parseItems(initialItems.value),
            };
            if (collection) input.items = parseItems(items.value);
            if (collection) deps.collectionService.update(collection.id, input);
            else deps.collectionService.create(input);
            editor.replaceChildren();
            setAlert(alert, "");
            draw();
          } catch (error) {
            setAlert(formAlert, error.message || "Collection could not be saved");
          }
        });
        editor.replaceChildren(form);
      }

      async function reset(collection) {
        const yes = await confirmDialog({
          title: "Reset collection",
          text: `Restore initial items for ${collection.name}?`,
          confirmLabel: "Reset",
        });
        if (!yes) return;
        deps.collectionService.reset(collection.id);
        draw();
      }

      async function remove(collection) {
        const yes = await confirmDialog({
          title: "Delete collection",
          text: `Delete ${collection.name}?`,
          confirmLabel: "Delete",
        });
        if (!yes) return;
        try {
          deps.collectionService.remove(collection.id);
          setAlert(alert, "");
          draw();
        } catch (error) {
          setAlert(alert, error.message || "Collection could not be deleted");
        }
      }

      draw();
    },
    unmount() {},
  };
}
