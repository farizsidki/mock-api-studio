import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { createImportExportService } from "../../site/js/services/import-export-service.js";
import { validateImportDocument } from "../../site/js/utils/validation.js";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";

const key = "mockApiStudio:workspace:v1";

function setup(initial) {
  const storage = createMemoryStorage();
  const storageService = createStorageService({ storage, key });
  if (initial) storageService.saveWorkspace(initial);
  const service = createImportExportService({
    storageService,
    clock: () => Date.parse("2026-01-01T00:00:00.000Z"),
  });
  return { service, storageService };
}

function documentFor(workspace) {
  return JSON.stringify({
    app: "mock-api-studio",
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    endpoints: workspace.endpoints,
    collections: workspace.collections,
  });
}

test("export and replace import round-trip workspace data", () => {
  const workspace = {
    schemaVersion: 1,
    endpoints: [],
    collections: [{
      id: "col_users",
      name: "Users",
      idField: "id",
      idStrategy: "autoIncrement",
      initialItems: [{ id: 1, name: "Alex" }],
      items: [{ id: 1, name: "Alex" }],
    }],
  };
  const { service, storageService } = setup(workspace);
  const exported = service.exportWorkspace();
  assert.equal(exported.app, "mock-api-studio");
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.exportedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(Object.hasOwn(exported, "logs"), false);
  const preview = service.validateImport(documentFor({ endpoints: [], collections: [] }));
  assert.deepEqual(preview, { ok: true, summary: { endpoints: 0, collections: 0, presets: 0 } });
  service.importWorkspace(documentFor({ endpoints: [], collections: [] }), { strategy: "replace" });
  assert.equal(storageService.loadWorkspace().collections.length, 0);
  service.importWorkspace(JSON.stringify(exported), { strategy: "replace" });
  assert.equal(storageService.loadWorkspace().collections[0].items[0].name, "Alex");
});

test("invalid import does not replace the saved workspace", () => {
  const { service, storageService } = setup({
    schemaVersion: 1,
    endpoints: [],
    collections: [],
  });
  const before = storageService.loadWorkspace();
  const result = service.validateImport("{");
  assert.equal(result.ok, false);
  assert.throws(
    () => service.importWorkspace("{", { strategy: "replace" }),
    (error) => error.code === "IMPORT_INVALID",
  );
  assert.deepEqual(storageService.loadWorkspace(), before);
  assert.throws(
    () => service.importWorkspace(documentFor({ endpoints: [], collections: [] }), { strategy: "append" }),
    (error) => error.code === "IMPORT_INVALID",
  );
});

test("validate then import parses the same text once", () => {
  let calls = 0;
  const { storageService } = setup({ schemaVersion: 1, endpoints: [], collections: [] });
  const service = createImportExportService({
    storageService,
    clock: () => Date.parse("2026-01-01T00:00:00.000Z"),
    validator(data) {
      calls += 1;
      return validateImportDocument(data);
    },
  });
  const text = documentFor({ endpoints: [], collections: [] });
  assert.equal(service.validateImport(text).ok, true);
  service.importWorkspace(text, { strategy: "replace" });
  assert.equal(calls, 1);
});

function endpoint(id, path) {
  return {
    id,
    name: path,
    method: "GET",
    path,
    enabled: true,
    delayMs: 0,
    handler: { type: "static", response: { status: 200, headers: {}, body: null } },
  };
}

test("merge keeps the current endpoint when the file adds another", () => {
  const { service, storageService } = setup({
    schemaVersion: 1,
    endpoints: [endpoint("ep_users", "/users")],
    collections: [],
  });
  service.importWorkspace(documentFor({
    endpoints: [endpoint("ep_posts", "/posts")],
    collections: [],
  }), { strategy: "merge" });
  const paths = storageService.loadWorkspace().endpoints.map((item) => item.path).sort();
  assert.deepEqual(paths, ["/posts", "/users"]);
});

test("merge conflict does not remove the saved workspace", () => {
  const { service, storageService } = setup({
    schemaVersion: 1,
    endpoints: [endpoint("ep_users", "/users"), endpoint("ep_posts", "/posts")],
    collections: [],
  });
  const before = storageService.loadWorkspace();
  assert.throws(
    () => service.importWorkspace(documentFor({
      endpoints: [endpoint("ep_other", "/users")],
      collections: [],
    }), { strategy: "merge" }),
    (error) => error.code === "IMPORT_INVALID" && error.message.includes("conflict"),
  );
  assert.deepEqual(storageService.loadWorkspace().endpoints.map((item) => item.id), before.endpoints.map((item) => item.id));
});

test("oversized import is rejected from the byte length", () => {
  const { service } = setup({ schemaVersion: 1, endpoints: [], collections: [] });
  const text = Buffer.alloc(2_097_153, 0x61).toString("utf8");
  const result = service.validateImport(text);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "IMPORT_TOO_LARGE");
});
