import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorageService } from "../../site/js/services/storage-service.js";
import { createMemoryStorage } from "../helpers/memory-storage.js";

const key = "mockApiStudio:workspace:v1";

test("save then load round-trips the workspace", () => {
  const storage = createMemoryStorage();
  const service = createStorageService({ storage, key });
  const saved = service.saveWorkspace({
    schemaVersion: 1,
    endpoints: [],
    collections: [],
  });
  assert.deepEqual(service.loadWorkspace(), saved);
  assert.equal(Object.hasOwn(JSON.parse(storage.getItem(key)), "exportedAt"), false);
});

test("missing storage loads an empty workspace", () => {
  const service = createStorageService({ storage: createMemoryStorage(), key });
  assert.deepEqual(service.loadWorkspace(), {
    schemaVersion: 1,
    endpoints: [],
    collections: [],
  });
});

test("corrupt json and unknown schema throw and clear removes the key", () => {
  const storage = createMemoryStorage();
  storage.setItem(key, "{");
  const service = createStorageService({ storage, key });
  assert.throws(() => service.loadWorkspace(), (error) => error.code === "STORAGE_CORRUPT");
  storage.setItem(key, JSON.stringify({ schemaVersion: 9, endpoints: [], collections: [] }));
  assert.throws(() => service.loadWorkspace(), (error) => error.code === "STORAGE_CORRUPT");
  service.clearWorkspace();
  assert.equal(storage.getItem(key), null);
});

test("a loaded workspace cannot overwrite a newer save from another tab", () => {
  const storage = createMemoryStorage();
  const older = createStorageService({ storage, key });
  const newer = createStorageService({ storage, key });
  const stale = older.loadWorkspace();
  const fresh = newer.loadWorkspace();
  newer.saveWorkspace(fresh);
  assert.throws(
    () => older.saveWorkspace(stale),
    (error) => error.code === "CONFLICT",
  );
  assert.deepEqual(older.loadWorkspace(), fresh);
});

test("a repeated load and save in one tab still works", () => {
  const service = createStorageService({ storage: createMemoryStorage(), key });
  const first = service.loadWorkspace();
  service.saveWorkspace(first);
  const second = service.loadWorkspace();
  const saved = service.saveWorkspace(second);
  assert.deepEqual(service.loadWorkspace(), saved);
});

test("write and read failures become domain errors", () => {
  const storage = createMemoryStorage();
  storage.setItem = () => {
    throw new Error("quota");
  };
  const service = createStorageService({ storage, key });
  assert.throws(
    () => service.saveWorkspace({ schemaVersion: 1, endpoints: [], collections: [] }),
    (error) => error.code === "STORAGE_WRITE_FAILED" && !error.message.includes("quota"),
  );
  const unreadable = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {},
    removeItem() {},
  };
  assert.throws(
    () => createStorageService({ storage: unreadable, key }).loadWorkspace(),
    (error) => error.code === "STORAGE_UNAVAILABLE",
  );
});
