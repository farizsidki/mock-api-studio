import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "../../site/js/core/logger.js";

function entry(path, status, method = "GET") {
  return { method, path, status, elapsedMs: 1, matchedEndpointId: null };
}

test("logger keeps the newest 200 entries and filters copies", () => {
  let now = 0;
  const logger = createLogger({ clock: () => now });
  for (let index = 0; index < 201; index += 1) {
    now = index;
    logger.add(entry(`/${index}`, index === 5 ? 404 : 200, index === 4 ? "POST" : "GET"));
  }
  const rows = logger.list();
  assert.equal(rows.length, 200);
  assert.equal(rows[0].path, "/1");
  assert.equal(rows[0].timestamp, new Date(1).toISOString());
  rows[0].path = "hack";
  assert.equal(logger.list()[0].path, "/1");
  assert.deepEqual(logger.list({ method: "POST" }).map((row) => row.path), ["/4"]);
  assert.deepEqual(logger.list({ status: 404 }).map((row) => row.path), ["/5"]);
  logger.clear();
  assert.deepEqual(logger.list(), []);
});
