import assert from "node:assert/strict";
import { test } from "node:test";
import { createMockEngine } from "../../site/js/core/mock-engine.js";
import { sampleWorkspace as fromSite } from "../../site/js/fixtures/sample-workspace.js";
import { createCollectionService } from "../../site/js/services/collection-service.js";
import { createEndpointService } from "../../site/js/services/endpoint-service.js";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { validateStoredWorkspace } from "../../site/js/utils/validation.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";
import { sampleWorkspace as fromTests } from "../fixtures/sample-workspace.js";

test("sample workspace is valid, shared, and serves users crud", async () => {
  assert.equal(fromSite, fromTests);
  validateStoredWorkspace(fromSite);
  assert.equal(fromSite.collections[0].items[0].name, "Alex");
  assert.equal(fromSite.endpoints.length, 6);
  const storageService = createStorageService({
    storage: createMemoryStorage(),
    key: "mockApiStudio:workspace:v1",
  });
  storageService.saveWorkspace(fromSite);
  const endpointService = createEndpointService({
    storageService,
    idGenerator: () => "ep_unused",
  });
  const collectionService = createCollectionService({
    storageService,
    idGenerator: () => "col_unused",
  });
  let now = 0;
  const engine = createMockEngine({
    endpointService,
    collectionService,
    logger: { add() {} },
    sleep: async (ms) => {
      now += ms;
    },
    clock: () => now,
  });
  const listed = await engine.simulateRequest({
    method: "GET",
    url: "/api/v1/users",
    headers: {},
    bodyText: "",
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data[0].email, "alex@example.com");
  assert.equal(listed.elapsedMs, 250);
  const one = await engine.simulateRequest({
    method: "GET",
    url: "/api/v1/users/1",
    headers: {},
    bodyText: "",
  });
  assert.equal(one.body.data.name, "Alex");
  const created = await engine.simulateRequest({
    method: "POST",
    url: "/api/v1/users",
    headers: {},
    bodyText: "{\"name\":\"Sam\"}",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.id, 2);
});
