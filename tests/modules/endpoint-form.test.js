import assert from "node:assert/strict";
import { test } from "node:test";
import { appendScenario, withoutField, withoutId } from "../../site/js/modules/endpoint-form.js";

test("a scenario can be removed and bad json does not append", () => {
  assert.throws(
    () => appendScenario([], { id: "sc_1", name: "Empty", status: 200, headers: {}, bodyText: "{" }),
    SyntaxError,
  );
  const added = appendScenario([], { id: "sc_1", name: "Empty", status: 200, headers: {}, bodyText: "" });
  assert.equal(added[0].response.body, null);
  assert.deepEqual(withoutId(added, "sc_1"), []);
  assert.deepEqual(withoutField([{ field: "name", type: "string", required: true }], "name"), []);
});
