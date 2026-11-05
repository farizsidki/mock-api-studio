import { cloneData, isPlainObject } from "./json.js";
import { inspectPath, routesConflict } from "../core/route-matcher.js";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const SCHEMA_VERSION = 1;
export const APP_ID = "mock-api-studio";
export const IMPORT_MAX_BYTES = 2_097_152;

const OPERATIONS = {
  list: "GET",
  getById: "GET",
  create: "POST",
  replace: "PUT",
  update: "PATCH",
  delete: "DELETE",
};
const ID_PARAM_OPERATIONS = new Set(["getById", "replace", "update", "delete"]);
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export function createDomainError({ code, message, status = 422 }) {
  const error = new Error(message);
  error.name = "DomainError";
  error.code = code;
  error.status = status;
  return error;
}

export function isDomainError(error) {
  return Boolean(error) && error.name === "DomainError" && typeof error.code === "string";
}

function fail(code, message, status = 422) {
  throw createDomainError({ code, message, status });
}

function assertExactKeys(value, allowed, code, label) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object`);
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) fail(code, `Unexpected field ${key}`);
  }
}

function assertJsonValue(value, code) {
  if (value === null) return;
  if (typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(code, "Body must be valid JSON");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => assertJsonValue(item, code));
    return;
  }
  if (!isPlainObject(value)) fail(code, "Body must be valid JSON");
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) fail(code, "Body must be valid JSON");
    assertJsonValue(value[key], code);
  }
}

function normalizeAuth(auth, code) {
  if (auth == null) {
    return { enabled: false, type: "bearer", headerName: "Authorization", expectedValue: "" };
  }
  assertExactKeys(auth, ["enabled", "type", "headerName", "expectedValue"], code, "Authentication");
  if (typeof auth.enabled !== "boolean") fail(code, "Authentication enabled must be boolean");
  if (auth.type !== "bearer" && auth.type !== "apiKey") fail(code, "Authentication type is not supported");
  if (typeof auth.expectedValue !== "string") fail(code, "Authentication expected value is required");
  const headerName = auth.headerName || "Authorization";
  if (typeof headerName !== "string" || !HEADER_NAME.test(headerName)) {
    fail(code, "Authentication header name is invalid");
  }
  if (auth.enabled && auth.expectedValue.length === 0) fail(code, "Authentication expected value is required");
  return {
    enabled: auth.enabled,
    type: auth.type,
    headerName,
    expectedValue: auth.expectedValue,
  };
}

function normalizeHeaders(headers, code) {
  if (headers == null) return {};
  if (!isPlainObject(headers)) fail(code, "Header name is invalid");
  const seen = new Set();
  const normalized = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!HEADER_NAME.test(name)) fail(code, "Header name is invalid");
    if (typeof value !== "string") fail(code, "Header value must be a string");
    const key = name.toLowerCase();
    if (seen.has(key)) fail(code, "Duplicate header name");
    seen.add(key);
    normalized[name] = value;
  }
  return normalized;
}

function normalizeHandler(handler, method, path, collections, code) {
  if (!isPlainObject(handler)) fail(code, "Handler type is not supported");
  if (handler.type === "static") {
    assertExactKeys(handler, ["type", "response"], code, "Handler");
    assertExactKeys(handler.response, ["status", "headers", "body"], code, "Response");
    if (!Number.isInteger(handler.response.status) || handler.response.status < 100 || handler.response.status > 599) {
      fail(code, "Status must be an integer from 100 to 599");
    }
    assertJsonValue(handler.response.body, code);
    return {
      type: "static",
      response: {
        status: handler.response.status,
        headers: normalizeHeaders(handler.response.headers, code),
        body: cloneData(handler.response.body),
      },
    };
  }
  if (handler.type !== "collection") fail(code, "Handler type is not supported");
  assertExactKeys(handler, ["type", "collectionId", "operation"], code, "Handler");
  const expectedMethod = OPERATIONS[handler.operation];
  if (!expectedMethod) fail(code, "Operation is not supported");
  if (expectedMethod !== method) fail(code, "Operation does not match the method");
  const collection = collections.find((item) => item.id === handler.collectionId);
  if (!collection) fail(code, "Collection was not found");
  if (ID_PARAM_OPERATIONS.has(handler.operation)) {
    const inspected = inspectPath(path);
    if (!inspected.ok || !inspected.segments.includes(`:${collection.idField}`)) {
      fail(code, "Path must include the collection id parameter");
    }
  }
  return {
    type: "collection",
    collectionId: handler.collectionId,
    operation: handler.operation,
  };
}

export function validateEndpointInput(input, context, code = "VALIDATION_ERROR") {
  const allowed = ["name", "method", "path", "enabled", "delayMs", "handler"];
  if (input?.auth !== undefined) allowed.push("auth");
  assertExactKeys(input, allowed, code, "Endpoint");
  if (typeof input.name !== "string" || input.name.trim() === "") fail(code, "Name is required");
  if (!HTTP_METHODS.includes(input.method)) fail(code, "Method is not supported");
  const inspected = inspectPath(input.path);
  if (!inspected.ok) fail(code, "Path is invalid");
  if (typeof input.enabled !== "boolean") fail(code, "Enabled must be boolean");
  if (!Number.isInteger(input.delayMs) || input.delayMs < 0 || input.delayMs > 5000) {
    fail(code, "Delay must be an integer from 0 to 5000");
  }
  const handler = normalizeHandler(input.handler, input.method, inspected.path, context.collections, code);
  const auth = normalizeAuth(input.auth, code);
  const conflict = context.endpoints.some((endpoint) => (
    endpoint.id !== context.ignoreId
    && endpoint.method === input.method
    && routesConflict(endpoint.path, inspected.path)
  ));
  if (conflict) fail(code, "Method and path conflict with an existing endpoint");
  return {
    name: input.name.trim(),
    method: input.method,
    path: inspected.path,
    enabled: input.enabled,
    delayMs: input.delayMs,
    auth,
    handler,
  };
}

function idKey(id) {
  return `${typeof id}:${String(id)}`;
}

function validateItems(items, idField, idStrategy, code) {
  if (!Array.isArray(items)) fail(code, "Items must be an array of objects");
  const seen = new Set();
  return items.map((item) => {
    if (!isPlainObject(item)) fail(code, "Items must be an array of objects");
    assertJsonValue(item, code);
    if (!Object.hasOwn(item, idField)) fail(code, "Item id is missing");
    const id = item[idField];
    if (idStrategy === "autoIncrement") {
      if (!Number.isSafeInteger(id)) fail(code, "Auto increment ids must be integers");
    } else if (!(typeof id === "string" || Number.isSafeInteger(id))) {
      fail(code, "Item id must be a string or integer");
    }
    const key = idKey(id);
    if (seen.has(key)) fail(code, "Item ids must be unique");
    seen.add(key);
    return cloneData(item);
  });
}

export function validateCollectionInput(input, context, code = "VALIDATION_ERROR") {
  const allowed = ["name", "initialItems"];
  if (input?.idField !== undefined) allowed.push("idField");
  if (input?.idStrategy !== undefined) allowed.push("idStrategy");
  if (input?.items !== undefined) allowed.push("items");
  assertExactKeys(input, allowed, code, "Collection");
  if (typeof input.name !== "string" || input.name.trim() === "") fail(code, "Collection name is required");
  const idField = input.idField ?? "id";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(idField)) fail(code, "Id field is invalid");
  const idStrategy = input.idStrategy ?? "autoIncrement";
  if (idStrategy !== "autoIncrement" && idStrategy !== "provided") fail(code, "Id strategy is not supported");
  const initialItems = validateItems(input.initialItems ?? [], idField, idStrategy, code);
  const items = input.items === undefined
    ? cloneData(initialItems)
    : validateItems(input.items, idField, idStrategy, code);
  if (context.ignoreId) {
    for (const endpoint of context.endpoints) {
      if (endpoint.handler?.type !== "collection" || endpoint.handler.collectionId !== context.ignoreId) continue;
      if (!ID_PARAM_OPERATIONS.has(endpoint.handler.operation)) continue;
      const inspected = inspectPath(endpoint.path);
      if (!inspected.ok || !inspected.segments.includes(`:${idField}`)) {
        fail(code, "Id field change breaks an existing endpoint");
      }
    }
  }
  return {
    name: input.name.trim(),
    idField,
    idStrategy,
    initialItems,
    items,
  };
}

function validateIdentity(id, code, label) {
  if (typeof id !== "string" || id.trim() === "") fail(code, `${label} id is required`);
  return id;
}

function withoutId(record) {
  const copy = { ...record };
  delete copy.id;
  return copy;
}

function validateStoredCollections(collections, endpoints, code) {
  if (!Array.isArray(collections)) fail(code, "Collections must be an array");
  const ids = new Set();
  return collections.map((collection) => {
    assertExactKeys(collection, ["id", "name", "idField", "idStrategy", "initialItems", "items"], code, "Collection");
    const id = validateIdentity(collection.id, code, "Collection");
    if (ids.has(id)) fail(code, "Collection ids must be unique");
    ids.add(id);
    const value = validateCollectionInput(withoutId(collection), { collections, endpoints, ignoreId: id }, code);
    return { id, ...value };
  });
}

function validateStoredEndpoints(endpoints, collections, code) {
  if (!Array.isArray(endpoints)) fail(code, "Endpoints must be an array");
  const ids = new Set();
  return endpoints.map((endpoint) => {
    const allowed = ["id", "name", "method", "path", "enabled", "delayMs", "handler"];
    if (endpoint?.auth !== undefined) allowed.push("auth");
    assertExactKeys(endpoint, allowed, code, "Endpoint");
    const id = validateIdentity(endpoint.id, code, "Endpoint");
    if (ids.has(id)) fail(code, "Endpoint ids must be unique");
    ids.add(id);
    const value = validateEndpointInput(withoutId(endpoint), { endpoints, collections, ignoreId: id }, code);
    return { id, ...value };
  });
}

export function validateStoredWorkspace(data) {
  assertExactKeys(data, ["schemaVersion", "endpoints", "collections"], "STORAGE_CORRUPT", "Workspace");
  if (data.schemaVersion !== SCHEMA_VERSION) fail("STORAGE_CORRUPT", "Saved workspace version is not supported", 500);
  const collections = validateStoredCollections(data.collections, data.endpoints ?? [], "STORAGE_CORRUPT");
  const endpoints = validateStoredEndpoints(data.endpoints, collections, "STORAGE_CORRUPT");
  return { schemaVersion: SCHEMA_VERSION, endpoints, collections };
}

export function validateImportDocument(data) {
  if (!isPlainObject(data)) fail("IMPORT_INVALID", "Import file is not an object");
  const allowed = ["app", "schemaVersion", "endpoints", "collections"];
  if (data.exportedAt !== undefined) allowed.push("exportedAt");
  assertExactKeys(data, allowed, "IMPORT_INVALID", "Import");
  if (data.app !== APP_ID) fail("IMPORT_INVALID", "Import app id is not supported");
  if (data.schemaVersion !== SCHEMA_VERSION) fail("IMPORT_INVALID", "Import schema version is not supported");
  if (data.exportedAt !== undefined && typeof data.exportedAt !== "string") {
    fail("IMPORT_INVALID", "Import export time is invalid");
  }
  const collections = validateStoredCollections(data.collections, data.endpoints ?? [], "IMPORT_INVALID");
  const endpoints = validateStoredEndpoints(data.endpoints, collections, "IMPORT_INVALID");
  return { schemaVersion: SCHEMA_VERSION, endpoints, collections };
}
