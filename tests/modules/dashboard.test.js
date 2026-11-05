import assert from "node:assert/strict";
import { test } from "node:test";
import { resetConfirmText, resolveImportAction } from "../../site/js/modules/dashboard.js";

test("cancel does not turn a replace into a merge", () => {
  assert.equal(resolveImportAction(null, false), null);
  assert.equal(resolveImportAction("replace", false), null);
  assert.equal(resolveImportAction("merge", false), null);
  assert.equal(resolveImportAction("replace", true), "replace");
  assert.equal(resolveImportAction("merge", true), "merge");
  assert.match(resetConfirmText, /presets/);
});
