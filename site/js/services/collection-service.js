import { cloneData, isPlainObject } from "../utils/json.js";
import { createDomainError, validateCollectionInput } from "../utils/validation.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

function notFound() {
  return createDomainError({ code: "NOT_FOUND", message: "Collection was not found", status: 404 });
}

function result(status, body, error = null) {
  return { status, headers: { ...JSON_HEADERS }, body, error };
}

function validation(message) {
  return result(422, null, { code: "VALIDATION_ERROR", message });
}

function canonicalInteger(value) {
  return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value));
}

function idsEqual(stored, raw) {
  if (typeof stored === "number" && Number.isSafeInteger(stored) && canonicalInteger(raw)) {
    return stored === Number(raw);
  }
  return stored === raw;
}

export function createCollectionService({ storageService, idGenerator }) {
  function persist(workspace) {
    storageService.saveWorkspace(workspace);
  }

  function writeBody(body) {
    if (!isPlainObject(body)) return validation("JSON object body is required");
    return null;
  }

  function createItem(workspace, collection, body) {
    const invalid = writeBody(body);
    if (invalid) return invalid;
    const idField = collection.idField;
    const items = collection.items;
    let id = body[idField];
    const hasId = Object.hasOwn(body, idField);
    if (collection.idStrategy === "autoIncrement") {
      if (items.some((item) => !Number.isSafeInteger(item[idField]))) {
        return validation("Auto increment ids must be integers");
      }
      if (!hasId) {
        const max = items.reduce((current, item) => Math.max(current, item[idField]), 0);
        id = items.length === 0 ? 1 : max + 1;
      } else if (!Number.isSafeInteger(id)) {
        return validation("Auto increment ids must be integers");
      }
    } else if (!hasId || !(typeof id === "string" || Number.isSafeInteger(id))) {
      return validation("Item id must be a string or integer");
    }
    if (items.some((item) => item[idField] === id || idsEqual(item[idField], id))) {
      return result(409, null, { code: "CONFLICT", message: "Duplicate item id" });
    }
    const item = cloneData(body);
    item[idField] = id;
    items.push(item);
    persist(workspace);
    return result(201, { data: cloneData(item) });
  }

  function replaceItem(workspace, collection, itemIndex, body) {
    const invalid = writeBody(body);
    if (invalid) return invalid;
    const current = collection.items[itemIndex];
    const idField = collection.idField;
    if (Object.hasOwn(body, idField) && !idsEqual(current[idField], body[idField])) {
      return validation("Item id does not match the route");
    }
    const next = cloneData(body);
    next[idField] = current[idField];
    collection.items[itemIndex] = next;
    persist(workspace);
    return result(200, { data: cloneData(next) });
  }

  function updateItem(workspace, collection, itemIndex, body) {
    const invalid = writeBody(body);
    if (invalid) return invalid;
    const current = collection.items[itemIndex];
    const idField = collection.idField;
    if (Object.hasOwn(body, idField) && !idsEqual(current[idField], body[idField])) {
      return validation("Item id does not match the route");
    }
    const next = cloneData(current);
    for (const [key, value] of Object.entries(body)) {
      if (key === idField) continue;
      next[key] = cloneData(value);
    }
    collection.items[itemIndex] = next;
    persist(workspace);
    return result(200, { data: cloneData(next) });
  }

  function deleteItem(workspace, collection, itemIndex) {
    const [removed] = collection.items.splice(itemIndex, 1);
    persist(workspace);
    return result(200, { data: cloneData(removed) });
  }

  return {
    list() {
      return cloneData(storageService.loadWorkspace().collections);
    },
    getById(id) {
      const found = storageService.loadWorkspace().collections.find((collection) => collection.id === id);
      if (!found) throw notFound();
      return cloneData(found);
    },
    create(input) {
      const workspace = storageService.loadWorkspace();
      const value = validateCollectionInput(input, {
        collections: workspace.collections,
        endpoints: workspace.endpoints,
      });
      const id = idGenerator();
      if (workspace.collections.some((collection) => collection.id === id)) {
        throw createDomainError({ code: "CONFLICT", message: "Collection id already exists", status: 409 });
      }
      const collection = { id, ...value };
      workspace.collections.push(collection);
      persist(workspace);
      return cloneData(collection);
    },
    update(id, input) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.collections.findIndex((collection) => collection.id === id);
      if (index < 0) throw notFound();
      const current = workspace.collections[index];
      const value = validateCollectionInput({
        ...input,
        items: input.items === undefined ? current.items : input.items,
      }, {
        collections: workspace.collections,
        endpoints: workspace.endpoints,
        ignoreId: id,
      });
      const collection = { id, ...value };
      workspace.collections[index] = collection;
      persist(workspace);
      return cloneData(collection);
    },
    remove(id) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.collections.findIndex((collection) => collection.id === id);
      if (index < 0) throw notFound();
      const used = workspace.endpoints.some((endpoint) => (
        endpoint.handler?.type === "collection" && endpoint.handler.collectionId === id
      ));
      if (used) {
        throw createDomainError({
          code: "CONFLICT",
          message: "Collection is used by an endpoint",
          status: 409,
        });
      }
      const [removed] = workspace.collections.splice(index, 1);
      persist(workspace);
      return cloneData(removed);
    },
    reset(id) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.collections.findIndex((collection) => collection.id === id);
      if (index < 0) throw notFound();
      const collection = workspace.collections[index];
      collection.items = cloneData(collection.initialItems);
      persist(workspace);
      return cloneData(collection);
    },
    execute({ collectionId, operation, routeParams, body }) {
      const workspace = storageService.loadWorkspace();
      const index = workspace.collections.findIndex((collection) => collection.id === collectionId);
      if (index < 0) return validation("Collection was not found");
      const collection = workspace.collections[index];
      const idField = collection.idField;
      if (operation === "list") return result(200, { data: cloneData(collection.items) });
      if (operation === "create") return createItem(workspace, collection, body);
      if (!isPlainObject(routeParams) || !Object.hasOwn(routeParams, idField)) {
        return validation("Path must include the collection id parameter");
      }
      const itemIndex = collection.items.findIndex((item) => idsEqual(item[idField], routeParams[idField]));
      if (itemIndex < 0) {
        return result(404, null, { code: "RESOURCE_NOT_FOUND", message: "Resource not found" });
      }
      if (operation === "getById") return result(200, { data: cloneData(collection.items[itemIndex]) });
      if (operation === "replace") return replaceItem(workspace, collection, itemIndex, body);
      if (operation === "update") return updateItem(workspace, collection, itemIndex, body);
      if (operation === "delete") return deleteItem(workspace, collection, itemIndex);
      return validation("Operation is not supported");
    },
  };
}
