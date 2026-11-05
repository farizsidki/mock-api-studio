import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRoute } from "../../site/js/core/router.js";

test("known hashes resolve to their views", () => {
  assert.equal(resolveRoute("#/dashboard"), "dashboard");
  assert.equal(resolveRoute("#/endpoints"), "endpoints");
  assert.equal(resolveRoute("#/tester"), "tester");
  assert.equal(resolveRoute("#/collections"), "collections");
  assert.equal(resolveRoute("#/logs"), "logs");
  assert.equal(resolveRoute("#/docs"), "docs");
});

test("empty and unknown hashes resolve to dashboard", () => {
  assert.equal(resolveRoute(""), "dashboard");
  assert.equal(resolveRoute("#/missing"), "dashboard");
  assert.equal(resolveRoute("#/endpoints/"), "endpoints");
  assert.equal(resolveRoute("#/dashboard?x=1"), "dashboard");
});
