import assert from "node:assert/strict";
import { test } from "node:test";
import { matchShortcut } from "../../site/js/utils/shortcuts.js";

test("alt plus one opens dashboard unless typing", () => {
  assert.equal(matchShortcut({ altKey: true, key: "1", target: { tagName: "BODY" } }), "dashboard");
  assert.equal(matchShortcut({ altKey: true, key: "1", target: { tagName: "INPUT" } }), null);
  assert.equal(matchShortcut({ altKey: true, key: "6", target: { tagName: "BODY" } }), "docs");
  assert.equal(matchShortcut({ altKey: false, key: "1", target: { tagName: "BODY" } }), null);
});
