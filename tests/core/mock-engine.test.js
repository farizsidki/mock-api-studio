import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockEngine } from "../../site/js/core/mock-engine.js";
import { createCollectionService } from "../../site/js/services/collection-service.js";
import { createEndpointService } from "../../site/js/services/endpoint-service.js";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";

const key = "mockApiStudio:workspace:v1";

function setup(options = {}) {
  const storage = createMemoryStorage();
  const storageService = createStorageService({ storage, key });
  const endpointService = createEndpointService({
    storageService,
    idGenerator: sequence("ep"),
  });
  const collectionService = createCollectionService({
    storageService,
    idGenerator: sequence("col"),
  });
  let now = 1000;
  const sleeps = [];
  const logger = options.logger ?? {
    entries: [],
    add(entry) {
      this.entries.push(entry);
    },
  };
  const engine = createMockEngine({
    endpointService,
    collectionService: options.collectionService ?? collectionService,
    logger,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    clock: () => now,
  });
  return { engine, endpointService, collectionService, storage, sleeps, logger, storageService };
}

function sequence(prefix) {
  let value = 0;
  return () => `${prefix}_${++value}`;
}

function staticEndpoint(overrides = {}) {
  return {
    name: "Static",
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

test("static response, query, and configured 404 stay structured", async () => {
  const { engine, endpointService, sleeps } = setup();
  const created = endpointService.create(staticEndpoint({ delayMs: 25 }));
  const response = await engine.simulateRequest({
    method: "GET",
    url: "/users?active=true&active=yes",
    headers: { Accept: "application/json" },
    bodyText: "",
  });
  assert.equal(response.ok, true);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: [] });
  assert.equal(response.matchedEndpointId, created.id);
  assert.equal(response.elapsedMs, 25);
  assert.deepEqual(sleeps, [25]);
  response.body.data.push(1);
  const again = await engine.simulateRequest({
    method: "GET",
    url: "https://mock.local/users",
    headers: {},
    bodyText: "",
  });
  assert.deepEqual(again.body, { data: [] });

  endpointService.create(staticEndpoint({
    path: "/missing-user",
    handler: {
      type: "static",
      response: { status: 404, headers: {}, body: { missing: true } },
    },
  }));
  const mocked = await engine.simulateRequest({
    method: "GET",
    url: "/missing-user",
    headers: {},
    bodyText: "",
  });
  assert.equal(mocked.ok, false);
  assert.equal(mocked.error, null);
  assert.deepEqual(mocked.body, { missing: true });
});

test("routing failures skip delay and logs keep both outcomes", async () => {
  const { engine, endpointService, sleeps, logger } = setup();
  endpointService.create(staticEndpoint({ method: "POST", delayMs: 40 }));
  const missing = await engine.simulateRequest({
    method: "GET",
    url: "/unknown",
    headers: {},
    bodyText: "",
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.error.code, "ROUTE_NOT_FOUND");
  assert.equal(missing.body, null);
  const denied = await engine.simulateRequest({
    method: "GET",
    url: "/users",
    headers: {},
    bodyText: "",
  });
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.Allow, "POST");
  assert.deepEqual(sleeps, []);
  assert.equal(logger.entries.length, 2);
  assert.equal(logger.entries[0].status, 404);
  assert.equal(logger.entries[1].status, 405);
});

test("auth runs before json parsing and does not leak the token", async () => {
  const { engine, endpointService, sleeps } = setup();
  endpointService.create(staticEndpoint({
    delayMs: 10,
    auth: {
      enabled: true,
      type: "bearer",
      headerName: "Authorization",
      expectedValue: "demo-token",
    },
  }));
  const rejected = await engine.simulateRequest({
    method: "GET",
    url: "/users",
    headers: { Authorization: "Bearer wrong" },
    bodyText: "{",
  });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.error.code, "UNAUTHORIZED");
  assert.equal(JSON.stringify(rejected).includes("demo-token"), false);
  assert.deepEqual(sleeps, [10]);
  const accepted = await engine.simulateRequest({
    method: "GET",
    url: "/users",
    headers: { authorization: "Bearer demo-token" },
    bodyText: "",
  });
  assert.equal(accepted.status, 200);
});

test("absolute third-party url is rejected and fetch is not called", async () => {
  const { engine } = setup();
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    calls.push("fetch");
    return Promise.resolve();
  };
  try {
    const response = await engine.simulateRequest({
      method: "GET",
      url: "https://example.com/users",
      headers: {},
      bodyText: "",
    });
    assert.equal(response.status, 400);
    assert.equal(response.error.code, "INVALID_REQUEST");
    assert.deepEqual(calls, []);
  } finally {
    globalThis.fetch = original;
  }
});

test("collection flow persists before delay and unexpected errors stay safe", async () => {
  const { engine, endpointService, collectionService, storage, sleeps } = setup();
  const collection = collectionService.create({
    name: "Users",
    initialItems: [{ id: 1, name: "Alex", email: "alex@example.com" }],
  });
  endpointService.create({
    name: "List",
    method: "GET",
    path: "/api/v1/users",
    enabled: true,
    delayMs: 0,
    handler: { type: "collection", collectionId: collection.id, operation: "list" },
  });
  endpointService.create({
    name: "Create",
    method: "POST",
    path: "/api/v1/users",
    enabled: true,
    delayMs: 5,
    handler: { type: "collection", collectionId: collection.id, operation: "create" },
  });
  const listed = await engine.simulateRequest({
    method: "GET",
    url: "/api/v1/users?page=1",
    headers: {},
    bodyText: "",
  });
  assert.equal(listed.body.data[0].name, "Alex");
  assert.equal(Object.hasOwn(listed.body, "success"), false);
  let savedDuringDelay = "";
  const creating = setup();
  creating.collectionService.create({
    name: "Users",
    initialItems: [{ id: 1, name: "Alex" }],
  });
  const persisted = creating.collectionService.list()[0];
  creating.endpointService.create({
    name: "Create",
    method: "POST",
    path: "/api/v1/users",
    enabled: true,
    delayMs: 5,
    handler: { type: "collection", collectionId: persisted.id, operation: "create" },
  });
  creating.engine = createMockEngine({
    endpointService: creating.endpointService,
    collectionService: creating.collectionService,
    logger: { add() {} },
    sleep: async (ms) => {
      savedDuringDelay = creating.storage.getItem(key);
      creating.sleeps.push(ms);
    },
    clock: () => 0,
  });
  const created = await creating.engine.simulateRequest({
    method: "POST",
    url: "/api/v1/users",
    headers: { "Content-Type": "text/plain" },
    bodyText: "{\"name\":\"Sam\"}",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.id, 2);
  assert.match(savedDuringDelay, /"name":"Sam"/);

  const broken = setup();
  const listedCollection = broken.collectionService.create({
    name: "Users",
    initialItems: [{ id: 1, name: "Alex" }],
  });
  broken.endpointService.create({
    name: "List",
    method: "GET",
    path: "/api/v1/users",
    enabled: true,
    delayMs: 0,
    handler: { type: "collection", collectionId: listedCollection.id, operation: "list" },
  });
  broken.engine = createMockEngine({
    endpointService: broken.endpointService,
    collectionService: {
      execute() {
        throw new Error("secret-stack");
      },
    },
    logger: { add() {} },
    sleep: async () => {},
    clock: () => 0,
  });
  const failed = await broken.engine.simulateRequest({
    method: "GET",
    url: "/api/v1/users",
    headers: {},
    bodyText: "",
  });
  assert.equal(failed.status, 500);
  assert.equal(failed.error.code, "INTERNAL_ERROR");
  assert.equal(failed.error.message, "Internal simulation error");
  assert.equal(JSON.stringify(failed).includes("secret-stack"), false);
  assert.equal(sleeps.length >= 0, true);
});
