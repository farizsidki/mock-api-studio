import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestHistory, findHistoryEntry } from "../../site/js/core/request-history.js";

test("keeps the newest twenty requests", () => {
  const history = createRequestHistory();
  for (let index = 0; index < 21; index += 1) {
    history.add({ method: "GET", url: `/${index}`, headers: { Accept: "application/json" }, bodyText: "" });
  }
  const list = history.list();
  assert.equal(list.length, 20);
  assert.equal(list[0].url, "/20");
  assert.equal(list[19].url, "/1");
  list[0].headers.Accept = "changed";
  assert.equal(history.list()[0].headers.Accept, "application/json");
});

test("blank history selection does not resolve the newest request", () => {
  const history = createRequestHistory();
  history.add({ method: "GET", url: "/newest", headers: {}, bodyText: "" });
  history.add({ method: "POST", url: "/older", headers: {}, bodyText: "" });
  const list = history.list();
  assert.equal(list[0].url, "/older");
  assert.equal(findHistoryEntry(list, ""), null);
  assert.equal(findHistoryEntry(list, list[0].id).url, "/older");
  assert.notEqual(list[0].id, list[1].id);
});
