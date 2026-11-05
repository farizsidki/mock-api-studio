import assert from "node:assert/strict";
import { test } from "node:test";
import { createCollectionService } from "../../site/js/services/collection-service.js";
import { createEndpointService } from "../../site/js/services/endpoint-service.js";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";

function setup() {
  const storageService = createStorageService({
    storage: createMemoryStorage(),
    key: "mockApiStudio:workspace:v1",
  });
  let next = 0;
  const collections = createCollectionService({
    storageService,
    idGenerator: () => `col_${++next}`,
  });
  const endpoints = createEndpointService({
    storageService,
    idGenerator: () => "ep_1",
  });
  return { collections, endpoints };
}

test("collection crud and reset keep the initial items", () => {
  const { collections } = setup();
  const created = collections.create({
    name: "Users",
    initialItems: [{ id: 1, name: "Alex" }],
  });
  assert.equal(created.id, "col_1");
  collections.execute({
    collectionId: created.id,
    operation: "update",
    routeParams: { id: "1" },
    body: { name: "Sam" },
  });
  assert.equal(collections.reset(created.id).items[0].name, "Alex");
  assert.equal(collections.remove(created.id).id, "col_1");
});

test("item operations follow the collection contract", () => {
  const { collections } = setup();
  const created = collections.create({
    name: "Users",
    initialItems: [{ id: 1, name: "Alex", profile: { city: "A", nick: "Al" } }],
  });
  const listed = collections.execute({
    collectionId: created.id,
    operation: "list",
    routeParams: {},
    body: undefined,
  });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, {
    data: [{ id: 1, name: "Alex", profile: { city: "A", nick: "Al" } }],
  });
  listed.body.data[0].name = "Hack";
  assert.equal(collections.getById(created.id).items[0].name, "Alex");

  const found = collections.execute({
    collectionId: created.id,
    operation: "getById",
    routeParams: { id: "1" },
    body: undefined,
  });
  assert.equal(found.body.data.email, undefined);
  assert.equal(found.body.data.name, "Alex");

  const made = collections.execute({
    collectionId: created.id,
    operation: "create",
    routeParams: {},
    body: { name: "Sam" },
  });
  assert.equal(made.status, 201);
  assert.equal(made.body.data.id, 2);

  const conflict = collections.execute({
    collectionId: created.id,
    operation: "create",
    routeParams: {},
    body: { id: 2, name: "Other" },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.error.code, "CONFLICT");

  const replaced = collections.execute({
    collectionId: created.id,
    operation: "replace",
    routeParams: { id: "2" },
    body: { name: "Samuel" },
  });
  assert.deepEqual(replaced.body.data, { id: 2, name: "Samuel" });
  const badId = collections.execute({
    collectionId: created.id,
    operation: "replace",
    routeParams: { id: "2" },
    body: { id: 9, name: "Nope" },
  });
  assert.equal(badId.status, 422);

  const patched = collections.execute({
    collectionId: created.id,
    operation: "update",
    routeParams: { id: "1" },
    body: { profile: { city: "B" } },
  });
  assert.deepEqual(patched.body.data.profile, { city: "B" });
  assert.equal(patched.body.data.name, "Alex");

  const removed = collections.execute({
    collectionId: created.id,
    operation: "delete",
    routeParams: { id: "1" },
    body: undefined,
  });
  assert.equal(removed.body.data.name, "Alex");
  const missing = collections.execute({
    collectionId: created.id,
    operation: "getById",
    routeParams: { id: "1" },
    body: undefined,
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.error.code, "RESOURCE_NOT_FOUND");
});

test("a collection used by an endpoint cannot be removed", () => {
  const { collections, endpoints } = setup();
  const created = collections.create({ name: "Users", initialItems: [{ id: 1, name: "Alex" }] });
  endpoints.create({
    name: "Get user",
    method: "GET",
    path: "/users/:id",
    enabled: true,
    delayMs: 0,
    handler: { type: "collection", collectionId: created.id, operation: "getById" },
  });
  assert.throws(() => collections.remove(created.id), (error) => error.code === "CONFLICT");
});
