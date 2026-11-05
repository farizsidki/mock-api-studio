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

test("exports text lines for the retained entries", () => {
  const logger = createLogger({ clock: () => 0 });
  logger.add(entry("/a", 200, "GET"));
  logger.add(entry("/b", 201, "POST"));
  const text = logger.exportLogs("text");
  const lines = text.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /GET \/a 200 1ms/);
  assert.match(lines[1], /POST \/b 201 1ms/);
  const json = JSON.parse(logger.exportLogs("json"));
  assert.equal(json[0].path, "/a");
});
