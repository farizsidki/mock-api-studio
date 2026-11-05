import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";

test("pages shell uses relative assets and module script", () => {
  const html = readFileSync("site/index.html", "utf8");
  assert.match(html, /type="module"/);
  assert.match(html, /src="\.\/js\/app\.js"/);
  for (const file of ["tokens.css", "base.css", "layout.css", "components.css", "responsive.css"]) {
    assert.match(html, new RegExp(`href="\\./css/${file}"`));
  }
  assert.doesNotMatch(html, /(?:src|href)="\//);
  assert.equal(statSync("site/.nojekyll").isFile(), true);
});

test("package.json stays free of runtime dependencies", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.scripts.test, "node --test");
  assert.equal(pkg.dependencies, undefined);
});
