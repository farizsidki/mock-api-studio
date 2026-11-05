import assert from "node:assert/strict";
import { test } from "node:test";
import { readTheme, themeRecord } from "../../site/js/utils/theme.js";

test("saved theme wins and broken settings use the system choice", () => {
  assert.equal(readTheme(themeRecord("light"), false), "light");
  assert.equal(readTheme(themeRecord("dark"), true), "dark");
  assert.equal(readTheme(null, true), "light");
  assert.equal(readTheme("{", false), "dark");
  assert.equal(readTheme("{\"theme\":\"blue\"}", true), "light");
});
