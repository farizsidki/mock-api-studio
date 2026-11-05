import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isDomainError,
  validateCollectionInput,
  validateEndpointInput,
  validateImportDocument,
  validateStoredWorkspace,
} from "../../site/js/utils/validation.js";

function endpoint(overrides = {}) {
  return {
    name: "List",
    method: "GET",
    path: "/users",
    enabled: true,
    delayMs: 0,
    handler: {
      type: "static",
      response: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { data: [] },
      },
    },
    ...overrides,
  };
}

test("static endpoint normalizes auth and keeps a null body", () => {
  const value = validateEndpointInput({
    ...endpoint(),
    path: "/users/",
    handler: {
      type: "static",
      response: { status: 204, headers: {}, body: null },
    },
  }, { endpoints: [], collections: [] });
  assert.equal(value.path, "/users");
  assert.equal(value.auth.enabled, false);
  assert.equal(value.handler.response.body, null);
});

test("duplicate and equally specific routes are rejected", () => {
  const existing = [{ id: "ep_1", ...endpoint({ path: "/users/:id" }) }];
  assert.throws(
    () => validateEndpointInput(endpoint({ path: "/users/:userId" }), {
      endpoints: existing,
      collections: [],
    }),
    (error) => isDomainError(error) && error.code === "VALIDATION_ERROR",
  );
});

test("exact route may coexist with a dynamic route", () => {
  const existing = [{ id: "ep_1", ...endpoint({ path: "/users/:id" }) }];
  const value = validateEndpointInput(endpoint({ path: "/users/new" }), {
    endpoints: existing,
    collections: [],
  });
  assert.equal(value.path, "/users/new");
});

test("collection operation must match the method and id parameter", () => {
  const collections = [{
    id: "col_users",
    name: "Users",
    idField: "id",
    idStrategy: "autoIncrement",
    initialItems: [],
    items: [],
  }];
  assert.throws(
    () => validateEndpointInput(endpoint({
      method: "GET",
      path: "/users",
      handler: { type: "collection", collectionId: "col_users", operation: "getById" },
    }), { endpoints: [], collections }),
    (error) => error.code === "VALIDATION_ERROR",
  );
  const value = validateEndpointInput(endpoint({
    method: "DELETE",
    path: "/users/:id",
    handler: { type: "collection", collectionId: "col_users", operation: "delete" },
  }), { endpoints: [], collections });
  assert.equal(value.handler.operation, "delete");
});

test("collection defaults and auto increment ids are enforced", () => {
  const value = validateCollectionInput({
    name: "Users",
    initialItems: [{ id: 1, name: "Alex" }],
  }, { collections: [], endpoints: [] });
  assert.equal(value.idField, "id");
  assert.equal(value.idStrategy, "autoIncrement");
  assert.deepEqual(value.items, [{ id: 1, name: "Alex" }]);
  assert.notEqual(value.items, value.initialItems);
  assert.throws(
    () => validateCollectionInput({
      name: "Users",
      idStrategy: "autoIncrement",
      initialItems: [{ id: "a", name: "Alex" }],
    }, { collections: [], endpoints: [] }),
    (error) => error.code === "VALIDATION_ERROR",
  );
});

test("stored workspace rejects unknown versions and import rejects a foreign app", () => {
  assert.throws(
    () => validateStoredWorkspace({ schemaVersion: 2, endpoints: [], collections: [] }),
    (error) => error.code === "STORAGE_CORRUPT",
  );
  assert.throws(
    () => validateImportDocument({
      app: "other",
      schemaVersion: 1,
      endpoints: [],
      collections: [],
    }),
    (error) => error.code === "IMPORT_INVALID",
  );
});
