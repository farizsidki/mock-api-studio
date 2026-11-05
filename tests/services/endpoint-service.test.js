import assert from "node:assert/strict";
import { test } from "node:test";
import { createEndpointService } from "../../site/js/services/endpoint-service.js";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";

function setup() {
  const storage = createMemoryStorage();
  const storageService = createStorageService({
    storage,
    key: "mockApiStudio:workspace:v1",
  });
  let next = 0;
  const service = createEndpointService({
    storageService,
    idGenerator: () => `ep_${++next}`,
  });
  return { service, storageService };
}

function input(overrides = {}) {
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

test("endpoint crud preserves ids and rejects duplicates", () => {
  const { service } = setup();
  const created = service.create(input());
  assert.equal(created.id, "ep_1");
  assert.equal(service.list()[0].name, "List");
  const updated = service.update(created.id, input({ name: "People", path: "/people" }));
  assert.equal(updated.id, "ep_1");
  assert.equal(updated.path, "/people");
  assert.equal(service.setEnabled(created.id, false).enabled, false);
  assert.throws(() => service.create(input({ path: "/people" })), (error) => error.code === "VALIDATION_ERROR");
  assert.equal(service.remove(created.id).id, "ep_1");
  assert.deepEqual(service.list(), []);
  assert.throws(() => service.getById("missing"), (error) => error.code === "NOT_FOUND");
});

test("duplicate avoids existing method and path", () => {
  const { service } = setup();
  const created = service.create(input());
  service.create(input({ name: "Get", path: "/users/:id" }));
  const first = service.duplicate(created.id);
  const second = service.duplicate(created.id);
  const dynamic = service.duplicate(service.list().find((item) => item.path === "/users/:id").id);
  assert.equal(first.path, "/users-copy");
  assert.equal(first.name, "List copy");
  assert.notEqual(first.id, created.id);
  assert.equal(second.path, "/users-copy-2");
  assert.equal(dynamic.path, "/users-copy/:id");
  assert.equal(service.getById(created.id).path, "/users");
  assert.throws(() => service.duplicate("missing"), (error) => error.code === "NOT_FOUND");
});

test("returned endpoints are copies", () => {
  const { service } = setup();
  const created = service.create(input());
  created.name = "Changed";
  assert.equal(service.getById(created.id).name, "List");
});
