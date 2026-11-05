import assert from "node:assert/strict";
import { test } from "node:test";
import { createPresetService } from "../../site/js/services/preset-service.js";
import { createImportExportService } from "../../site/js/services/import-export-service.js";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";

const key = "mockApiStudio:workspace:v1";

test("loads a workspace saved before presets existed", () => {
  const storage = createMemoryStorage();
  storage.setItem(key, JSON.stringify({ schemaVersion: 1, endpoints: [], collections: [] }));
  const storageService = createStorageService({ storage, key });
  let next = 0;
  const presets = createPresetService({
    storageService,
    idGenerator: () => `pre_${++next}`,
  });
  assert.deepEqual(storageService.loadWorkspace().presets, []);
  const created = presets.create({
    name: "List users",
    method: "GET",
    url: "/api/v1/users?page=1",
    headers: { Accept: "application/json" },
    bodyText: "",
  });
  assert.equal(created.id, "pre_1");
  const exported = createImportExportService({
    storageService,
    clock: () => Date.parse("2026-01-01T00:00:00.000Z"),
  }).exportWorkspace();
  assert.equal(exported.presets.length, 1);
  assert.equal(exported.presets[0].name, "List users");
});
